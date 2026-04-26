using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.AvailableSlots.Services;
using SmartStudyPlanner.Application.BehavioralLogs.Services;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;
using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Schedule.Mapping;

public class SchedulePayloadBuilder
{
    private const int RecentTaskHistorySize = 50;

    private readonly IAppDbContext _db;
    private readonly UserManager<ApplicationUser> _users;
    private readonly IBehavioralLogService _logs;
    private readonly IAvailableSlotService _slots;

    public SchedulePayloadBuilder(IAppDbContext db, UserManager<ApplicationUser> users, IBehavioralLogService logs, IAvailableSlotService slots)
    {
        _db = db;
        _users = users;
        _logs = logs;
        _slots = slots;
    }

    public async Task<AiOptimizeRequestDto> BuildAsync(int userId, DateOnly date, CancellationToken ct)
    {
        var user = await _users.FindByIdAsync(userId.ToString())
            ?? throw new NotFoundException("User", userId);

        var globalDeadline = user.Deadline
            ?? throw new ConflictException("Cannot generate a schedule before the user completes onboarding (deadline missing).");

        var recent = await _db.StudyTasks
            .Where(t => t.UserId == userId && (t.Status == StudyTaskStatus.Done || t.Status == StudyTaskStatus.Snoozed))
            .OrderByDescending(t => t.UpdatedAt)
            .Take(RecentTaskHistorySize)
            .Select(t => new AiRecentTaskDto
            {
                Id = t.Id,
                SubjectId = t.SubjectId,
                Estimated = t.EstimatedMinutes,
                Actual = (double)(t.ActualMinutes ?? t.EstimatedMinutes),
                Status = t.Status == StudyTaskStatus.Done ? "completed" : "snoozed"
            })
            .ToListAsync(ct);

        var todayLog = await _logs.GetTodayDtoAsync(userId, ct);

        var upcoming = await _db.StudyTasks
            .Include(t => t.Subject)
            .Where(t => t.UserId == userId
                && t.Status == StudyTaskStatus.Upcoming
                && (t.Deadline == null || t.Deadline >= date))
            .OrderBy(t => t.Priority).ThenBy(t => t.Deadline)
            .Select(t => new AiTaskDto
            {
                Id = t.Id,
                Subject = t.Subject!.Name,
                Priority = (int)t.Priority,
                DifficultyRating = t.DifficultyRating,
                DaysSinceLastStudy = t.DaysSinceLastStudy,
                ConsecutiveDaysStudied = t.ConsecutiveDaysStudied
            })
            .ToListAsync(ct);

        var slots = await _slots.ListForDateAsync(userId, date, ct);
        var slotPayload = slots.Select(s => new AiSlotDto
        {
            StartTime = s.StartTime.ToString("HH:mm"),
            EndTime = s.EndTime.ToString("HH:mm")
        }).ToList();

        return new AiOptimizeRequestDto
        {
            UserId = userId,
            Deadline = globalDeadline.ToString("yyyy-MM-dd"),
            RawHistory = new AiRawHistoryDto
            {
                RecentTasks = recent,
                BehavioralLogs = new AiBehavioralLogsDto
                {
                    SnoozeCountToday = todayLog.SnoozeCount,
                    LastFocusRatings = todayLog.LastFocusRatings,
                    StudyHoursToday = (double)todayLog.StudyHours
                }
            },
            CurrentTasksToPlan = upcoming,
            AvailableSlots = slotPayload
        };
    }
}
