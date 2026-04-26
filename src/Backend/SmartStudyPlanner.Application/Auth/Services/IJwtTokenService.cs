using SmartStudyPlanner.Application.Identity;

namespace SmartStudyPlanner.Application.Auth.Services;

public interface IJwtTokenService
{
    (string Token, DateTimeOffset ExpiresAt) CreateAccessToken(ApplicationUser user);
    string GenerateRawRefreshToken();
    string HashRefreshToken(string raw);
}
