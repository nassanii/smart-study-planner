using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using SmartStudyPlanner.Application.Auth.Dtos;
using SmartStudyPlanner.Application.Auth.Models;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.Auth.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly IJwtTokenService _jwt;
    private readonly IAppDbContext _db;
    private readonly TimeProvider _time;
    private readonly JwtSettings _settings;
    private readonly PasswordResetSettings _passwordReset;
    private readonly IEmailSender _email;
    private readonly ILogger<AuthService> _log;

    public AuthService(
        UserManager<ApplicationUser> users,
        IJwtTokenService jwt,
        IAppDbContext db,
        TimeProvider time,
        IOptions<JwtSettings> settings,
        IOptions<PasswordResetSettings> passwordReset,
        IEmailSender email,
        ILogger<AuthService> log)
    {
        _users = users;
        _jwt = jwt;
        _db = db;
        _time = time;
        _settings = settings.Value;
        _passwordReset = passwordReset.Value;
        _email = email;
        _log = log;
    }

    public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto, string? ip, CancellationToken ct)
    {
        var existing = await _users.FindByEmailAsync(dto.Email);
        if (existing is not null)
        {
            throw new ConflictException("A user with this email already exists.");
        }

        var now = _time.GetUtcNow();
        var user = new ApplicationUser
        {
            UserName = dto.Email,
            Email = dto.Email,
            Name = dto.Name,
            IsOnboarded = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        var result = await _users.CreateAsync(user, dto.Password);
        if (!result.Succeeded)
        {
            throw new ConflictException(string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        return await IssueTokensAsync(user, ip, ct);
    }

    public async Task<AuthResponseDto> LoginAsync(LoginDto dto, string? ip, CancellationToken ct)
    {
        var user = await _users.FindByEmailAsync(dto.Email);
        if (user is null)
        {
            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        var ok = await _users.CheckPasswordAsync(user, dto.Password);
        if (!ok)
        {
            await _users.AccessFailedAsync(user);
            throw new UnauthorizedAccessException("Invalid email or password.");
        }

        return await IssueTokensAsync(user, ip, ct);
    }

    public async Task<AuthResponseDto> RefreshAsync(string refreshToken, string? ip, CancellationToken ct)
    {
        var hash = _jwt.HashRefreshToken(refreshToken);
        var stored = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null)
        {
            throw new UnauthorizedAccessException("Invalid refresh token.");
        }

        if (stored.RevokedAt is not null)
        {
            _log.LogWarning("Refresh token reuse detected for user {UserId}; revoking entire chain.", stored.UserId);
            await RevokeChainAsync(stored.UserId, ct);
            throw new UnauthorizedAccessException("Refresh token has been revoked.");
        }

        if (_time.GetUtcNow() >= stored.ExpiresAt)
        {
            throw new UnauthorizedAccessException("Refresh token has expired.");
        }

        var user = await _users.FindByIdAsync(stored.UserId.ToString())
            ?? throw new UnauthorizedAccessException("User not found.");

        var (accessToken, expiresAt) = _jwt.CreateAccessToken(user);
        var newRaw = _jwt.GenerateRawRefreshToken();
        var newHash = _jwt.HashRefreshToken(newRaw);
        var now = _time.GetUtcNow();

        stored.RevokedAt = now;
        stored.ReplacedByTokenHash = newHash;

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = newHash,
            ExpiresAt = now.AddDays(_settings.RefreshTokenDays),
            CreatedAt = now,
            CreatedByIp = ip
        });

        await _db.SaveChangesAsync(ct);

        return new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = newRaw,
            ExpiresAt = expiresAt,
            User = ToMeDto(user)
        };
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct)
    {
        var hash = _jwt.HashRefreshToken(refreshToken);
        var stored = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (stored is null || stored.RevokedAt is not null)
        {
            return;
        }

        stored.RevokedAt = _time.GetUtcNow();
        await _db.SaveChangesAsync(ct);
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordDto dto, CancellationToken ct)
    {
        var user = await _users.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException("User", userId);

        var result = await _users.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
        if (!result.Succeeded)
        {
            throw new ConflictException(string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        await RevokeChainAsync(userId, ct);
    }

    public async Task ForgotPasswordAsync(string email, CancellationToken ct)
    {
        var user = await _users.FindByEmailAsync(email);
        if (user is null)
        {
            _log.LogInformation("Password reset requested for non-existing email {Email}.", email);
            return;
        }

        var now = _time.GetUtcNow();
        var code = GenerateResetCode();
        var expiresAt = now.AddMinutes(Math.Max(1, _passwordReset.CodeExpiryMinutes));

        var activeCodes = await _db.PasswordResetCodes
            .Where(c => c.UserId == user.Id && c.ConsumedAt == null)
            .ToListAsync(ct);

        foreach (var activeCode in activeCodes)
        {
            activeCode.ConsumedAt = now;
        }

        _db.PasswordResetCodes.Add(new PasswordResetCode
        {
            UserId = user.Id,
            CodeHash = HashResetCode(user, code),
            ExpiresAt = expiresAt,
            CreatedAt = now
        });

        await _db.SaveChangesAsync(ct);

        var resetLink = BuildResetLink(user.Email ?? email);

        await _email.SendAsync(new EmailMessage
        {
            ToEmail = user.Email ?? email,
            ToName = user.Name,
            Subject = "Reset your Smart Study password",
            TextBody = BuildPasswordResetText(user.Name, code, resetLink, expiresAt),
            HtmlBody = BuildPasswordResetHtml(user.Name, code, resetLink, expiresAt)
        }, ct);
    }

    public async Task ResetPasswordAsync(ResetPasswordDto dto, CancellationToken ct)
    {
        var user = await _users.FindByEmailAsync(dto.Email);
        if (user is null)
        {
            throw new ConflictException("Invalid or expired password reset code.");
        }

        var resetCode = await GetValidResetCodeAsync(user, dto.Code, ct);

        var token = await _users.GeneratePasswordResetTokenAsync(user);
        var result = await _users.ResetPasswordAsync(user, token, dto.NewPassword);
        if (!result.Succeeded)
        {
            throw new ConflictException("Invalid or expired password reset code.");
        }

        resetCode.ConsumedAt = _time.GetUtcNow();
        await _db.SaveChangesAsync(ct);
        await RevokeChainAsync(user.Id, ct);
    }

    public async Task VerifyResetCodeAsync(VerifyResetCodeDto dto, CancellationToken ct)
    {
        var user = await _users.FindByEmailAsync(dto.Email);
        if (user is null)
        {
            throw new ConflictException("Invalid or expired password reset code.");
        }

        await GetValidResetCodeAsync(user, dto.Code, ct);
    }

    public async Task<UserMeDto> GetMeAsync(int userId, CancellationToken ct)
    {
        var user = await _users.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException("User", userId);
        return ToMeDto(user);
    }

    private async Task<AuthResponseDto> IssueTokensAsync(ApplicationUser user, string? ip, CancellationToken ct)
    {
        var (accessToken, expiresAt) = _jwt.CreateAccessToken(user);
        var raw = _jwt.GenerateRawRefreshToken();
        var hash = _jwt.HashRefreshToken(raw);
        var now = _time.GetUtcNow();

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = now.AddDays(_settings.RefreshTokenDays),
            CreatedAt = now,
            CreatedByIp = ip
        });

        await _db.SaveChangesAsync(ct);

        return new AuthResponseDto
        {
            AccessToken = accessToken,
            RefreshToken = raw,
            ExpiresAt = expiresAt,
            User = ToMeDto(user)
        };
    }

    private async Task RevokeChainAsync(int userId, CancellationToken ct)
    {
        var now = _time.GetUtcNow();
        var tokens = await _db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);

        foreach (var t in tokens)
        {
            t.RevokedAt = now;
        }

        await _db.SaveChangesAsync(ct);
    }

    private string GenerateResetCode()
    {
        return RandomNumberGenerator.GetInt32(0, 100000).ToString("D5");
    }

    private async Task<PasswordResetCode> GetValidResetCodeAsync(ApplicationUser user, string code, CancellationToken ct)
    {
        var now = _time.GetUtcNow();
        var resetCode = await _db.PasswordResetCodes
            .Where(c => c.UserId == user.Id && c.ConsumedAt == null)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (resetCode is null)
        {
            throw new ConflictException("Invalid or expired password reset code.");
        }

        if (resetCode.ExpiresAt <= now)
        {
            resetCode.ConsumedAt = now;
            await _db.SaveChangesAsync(ct);
            throw new ConflictException("Invalid or expired password reset code.");
        }

        var maxAttempts = Math.Max(1, _passwordReset.MaxCodeAttempts);
        if (resetCode.AttemptCount >= maxAttempts)
        {
            resetCode.ConsumedAt = now;
            await _db.SaveChangesAsync(ct);
            throw new ConflictException("Invalid or expired password reset code.");
        }

        if (CodeMatches(resetCode.CodeHash, HashResetCode(user, code)))
        {
            return resetCode;
        }

        resetCode.AttemptCount++;
        if (resetCode.AttemptCount >= maxAttempts)
        {
            resetCode.ConsumedAt = now;
        }

        await _db.SaveChangesAsync(ct);
        throw new ConflictException("Invalid or expired password reset code.");
    }

    private string HashResetCode(ApplicationUser user, string code)
    {
        if (string.IsNullOrWhiteSpace(_settings.SigningKey))
        {
            throw new InvalidOperationException("Jwt:SigningKey is not configured.");
        }

        var key = Encoding.UTF8.GetBytes(_settings.SigningKey);
        var payload = $"{user.Id}:{user.SecurityStamp}:{code}";
        using var hmac = new HMACSHA256(key);
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    private static bool CodeMatches(string expectedHash, string actualHash)
    {
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedHash),
            Encoding.UTF8.GetBytes(actualHash));
    }

    private string BuildResetLink(string email)
    {
        if (string.IsNullOrWhiteSpace(_passwordReset.ResetUrl))
        {
            throw new InvalidOperationException("PasswordReset:ResetUrl is not configured.");
        }

        var separator = _passwordReset.ResetUrl.Contains('?') ? '&' : '?';
        return $"{_passwordReset.ResetUrl}{separator}email={Uri.EscapeDataString(email)}";
    }

    private static string BuildPasswordResetText(string? name, string code, string resetLink, DateTimeOffset expiresAt)
    {
        var greeting = string.IsNullOrWhiteSpace(name) ? "Hi" : $"Hi {name}";
        return $"""
            {greeting},

            We received a request to reset your Smart Study Planner password.

            Your reset code is:
            {code}

            Open this link and enter the code to choose a new password:
            {resetLink}

            This code expires at {expiresAt:HH:mm} UTC.

            If you did not request this, you can ignore this email.
            """;
    }

    private static string BuildPasswordResetHtml(string? name, string code, string resetLink, DateTimeOffset expiresAt)
    {
        var safeName = WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(name) ? "there" : name);
        var safeCode = WebUtility.HtmlEncode(code);
        var safeLink = WebUtility.HtmlEncode(resetLink);

        return $"""
            <!doctype html>
            <html lang="en">
            <body style="margin:0;padding:0;background:#f7f5ff;font-family:Arial,sans-serif;color:#151522;">
              <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
                <div style="background:#ffffff;border-radius:18px;padding:28px;border:1px solid #ece8ff;">
                  <h1 style="margin:0 0 12px;font-size:24px;">Reset your password</h1>
                  <p style="font-size:16px;line-height:1.5;margin:0 0 18px;">Hi {safeName},</p>
                  <p style="font-size:16px;line-height:1.5;margin:0 0 24px;">We received a request to reset your Smart Study Planner password.</p>
                  <p style="font-size:14px;line-height:1.5;color:#6b6b7a;margin:0 0 8px;">Your reset code is:</p>
                  <p style="font-size:34px;letter-spacing:8px;font-weight:700;margin:0 0 22px;color:#151522;">{safeCode}</p>
                  <p style="margin:0 0 24px;">
                    <a href="{safeLink}" style="display:inline-block;background:#6B5CE7;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:12px;font-weight:700;">Enter code and reset password</a>
                  </p>
                  <p style="font-size:13px;line-height:1.5;color:#6b6b7a;margin:0 0 8px;">This code expires at {expiresAt:HH:mm} UTC.</p>
                  <p style="font-size:13px;line-height:1.5;color:#6b6b7a;margin:0 0 8px;">If the button does not work, copy and paste this link into your browser:</p>
                  <p style="font-size:13px;line-height:1.5;word-break:break-all;margin:0;color:#6B5CE7;">{safeLink}</p>
                </div>
              </div>
            </body>
            </html>
            """;
    }

    private static UserMeDto ToMeDto(ApplicationUser u) => new()
    {
        UserId = u.Id,
        Name = u.Name,
        Email = u.Email ?? string.Empty,
        Deadline = u.Deadline,
        IsOnboarded = u.IsOnboarded,
        PushToken = u.PushToken
    };
}
