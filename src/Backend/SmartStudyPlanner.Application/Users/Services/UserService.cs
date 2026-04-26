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
    private readonly SmartStudyPlanner.Application.Schedule.Services.IScheduleService _schedule;

    public UserService(UserManager<ApplicationUser> users, IAppDbContext db, TimeProvider time, SmartStudyPlanner.Application.Schedule.Services.IScheduleService schedule)
    {
        _users = users;
        _db = db;
        _time = time;
        _schedule = schedule;
    }

    public async Task<UserMeDto> UpdateAsync(int userId, UpdateUserDto dto, CancellationToken ct)
    {
        var user = await _users.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException("User", userId);

        if (dto.Name is not null) user.Name = dto.Name;
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
            var subject = new Subject
            {
                UserId = userId,
                Name = s.Name,
                Difficulty = s.Difficulty,
                ExamDate = s.ExamDate,
                CreatedAt = _time.GetUtcNow()
            };
            _db.Subjects.Add(subject);

            // Create an initial task so the AI has something to plan immediately
            _db.StudyTasks.Add(new StudyTask
            {
                UserId = userId,
                Subject = subject,
                Status = SmartStudyPlanner.Domain.Enums.StudyTaskStatus.Upcoming,
                Priority = SmartStudyPlanner.Domain.Enums.TaskPriority.Medium,
                DifficultyRating = s.Difficulty,
                EstimatedMinutes = 50,
                CreatedAt = _time.GetUtcNow(),
                UpdatedAt = _time.GetUtcNow()
            });
        }

        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        foreach (var slot in dto.AvailableSlots)
        {
            _db.AvailableSlots.Add(new AvailableSlot
            {
                UserId = userId,
                Date = today,
                DayOfWeek = null,
                StartTime = slot.StartTime,
                EndTime = slot.EndTime
            });
        }

        await _users.UpdateAsync(user);
        await _db.SaveChangesAsync(ct);

        // Automatically trigger AI schedule generation so it's ready when they hit the dashboard
        await _schedule.GenerateAsync(userId, today, ct);

        return Map(user);
    }

    private static UserMeDto Map(ApplicationUser u) => new()
    {
        UserId = u.Id,
        Name = u.Name,
        Email = u.Email ?? string.Empty,
        Deadline = u.Deadline,
        IsOnboarded = u.IsOnboarded
    };
}
