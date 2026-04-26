using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
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
    private readonly ILogger<AuthService> _log;

    public AuthService(
        UserManager<ApplicationUser> users,
        IJwtTokenService jwt,
        IAppDbContext db,
        TimeProvider time,
        IOptions<JwtSettings> settings,
        ILogger<AuthService> log)
    {
        _users = users;
        _jwt = jwt;
        _db = db;
        _time = time;
        _settings = settings.Value;
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

    public async Task<string?> ForgotPasswordStubAsync(string email, CancellationToken ct)
    {
        var user = await _users.FindByEmailAsync(email);
        if (user is null)
        {
            return null;
        }

        var token = await _users.GeneratePasswordResetTokenAsync(user);
        _log.LogWarning("Password reset token for {Email}: {Token}", email, token);
        return token;
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

    private static UserMeDto ToMeDto(ApplicationUser u) => new()
    {
        UserId = u.Id,
        Name = u.Name,
        Email = u.Email ?? string.Empty,
        TargetGpa = u.TargetGpa,
        MaxHoursPerDay = u.MaxHoursPerDay,
        Deadline = u.Deadline,
        IsOnboarded = u.IsOnboarded
    };
}
