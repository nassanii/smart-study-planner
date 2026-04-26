using SmartStudyPlanner.Application.Auth.Dtos;

namespace SmartStudyPlanner.Application.Auth.Services;

public interface IAuthService
{
    Task<AuthResponseDto> RegisterAsync(RegisterDto dto, string? ip, CancellationToken ct);
    Task<AuthResponseDto> LoginAsync(LoginDto dto, string? ip, CancellationToken ct);
    Task<AuthResponseDto> RefreshAsync(string refreshToken, string? ip, CancellationToken ct);
    Task LogoutAsync(string refreshToken, CancellationToken ct);
    Task ChangePasswordAsync(int userId, ChangePasswordDto dto, CancellationToken ct);
    Task<string?> ForgotPasswordStubAsync(string email, CancellationToken ct);
    Task<UserMeDto> GetMeAsync(int userId, CancellationToken ct);
}
