using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.Auth.Dtos;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Application.Users.Dtos;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.Users.Services;

public class UserService : IUserService
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly IAppDbContext _db;
    private readonly TimeProvider _time;

    public UserService(UserManager<ApplicationUser> users, IAppDbContext db, TimeProvider time)
    {
        _users = users;
        _db = db;
        _time = time;
    }

    public async Task<UserMeDto> UpdateAsync(int userId, UpdateUserDto dto, CancellationToken ct)
    {
        var user = await _users.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException("User", userId);

        if (dto.Name is not null) user.Name = dto.Name;
        if (dto.TargetGpa.HasValue) user.TargetGpa = dto.TargetGpa;
        if (dto.MaxHoursPerDay.HasValue) user.MaxHoursPerDay = dto.MaxHoursPerDay;
        if (dto.Deadline.HasValue) user.Deadline = dto.Deadline;
        user.UpdatedAt = _time.GetUtcNow();

        var result = await _users.UpdateAsync(user);
        if (!result.Succeeded)
        {
            throw new ConflictException(string.Join("; ", result.Errors.Select(e => e.Description)));
        }
        return Map(user);
    }

    public async Task<UserMeDto> CompleteOnboardingAsync(int userId, OnboardingDto dto, CancellationToken ct)
    {
        var user = await _users.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException("User", userId);

        user.Name = dto.Name;
        user.TargetGpa = dto.TargetGpa;
        user.MaxHoursPerDay = dto.MaxHoursPerDay;
        user.Deadline = dto.Deadline;
        user.IsOnboarded = true;
        user.UpdatedAt = _time.GetUtcNow();

        var existingSubjects = await _db.Subjects
            .Where(s => s.UserId == userId)
            .Select(s => s.Name)
            .ToListAsync(ct);

        foreach (var s in dto.Subjects)
        {
            if (existingSubjects.Contains(s.Name)) continue;
            _db.Subjects.Add(new Subject
            {
                UserId = userId,
                Name = s.Name,
                Difficulty = s.Difficulty,
                ExamDate = s.ExamDate,
                CreatedAt = _time.GetUtcNow()
            });
        }

        await _users.UpdateAsync(user);
        await _db.SaveChangesAsync(ct);
        return Map(user);
    }

    private static UserMeDto Map(ApplicationUser u) => new()
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
