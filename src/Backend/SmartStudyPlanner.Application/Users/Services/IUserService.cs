using SmartStudyPlanner.Application.Auth.Dtos;
using SmartStudyPlanner.Application.Users.Dtos;

namespace SmartStudyPlanner.Application.Users.Services;

public interface IUserService
{
    Task<UserMeDto> UpdateAsync(int userId, UpdateUserDto dto, CancellationToken ct);
    Task<UserMeDto> CompleteOnboardingAsync(int userId, OnboardingDto dto, CancellationToken ct);
}
