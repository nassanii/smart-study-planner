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

        // User deadline is optional — derive a fallback from the latest course exam date,
        // or default to 6 months from today if no courses have exams yet.
        var fallbackDeadline = await _db.Subjects
            .Where(s => s.UserId == userId)
            .Select(s => (DateOnly?)(s.FinalDate ?? s.MidtermDate ?? s.ExamDate))
            .Where(d => d != null)
            .OrderByDescending(d => d)
            .FirstOrDefaultAsync(ct);

        var globalDeadline = user.Deadline
            ?? fallbackDeadline
            ?? DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(6));

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

        var subjects = await _db.Subjects
            .Where(s => s.UserId == userId)
            .Select(s => new AiSubjectDto
            {
                Id = s.Id,
                Name = s.Name,
                Difficulty = s.Difficulty,
                Priority = s.Priority,
                ExamDate = s.FinalDate ?? s.MidtermDate ?? s.ExamDate
            })
            .ToListAsync(ct);

        var slots = await _slots.ListForDateAsync(userId, date, ct);
        var slotPayload = slots.Select(s => new AiSlotDto
        {
            StartTime = s.StartTime.ToString("HH:mm"),
            EndTime = s.EndTime.ToString("HH:mm")
        }).ToList();

        // Manual blocks the user committed for this date — AI must not overlap or replace them.
        var fixedBlocks = await _db.StudyTasks
            .Include(t => t.Subject)
            .Where(t => t.UserId == userId
                && t.IsManual
                && t.StartTime != null
                && t.Deadline == date
                && t.Status != StudyTaskStatus.Done)
            .Select(t => new AiFixedBlockDto
            {
                Subject = t.Subject!.Name,
                StartTime = t.StartTime!.Value.ToString("HH:mm"),
                DurationMinutes = t.EstimatedMinutes,
                Topic = t.Tag,
                TaskId = t.Id
            })
            .ToListAsync(ct);

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
            Subjects = subjects,
            AvailableSlots = slotPayload,
            FixedBlocks = fixedBlocks
        };
    }
}
