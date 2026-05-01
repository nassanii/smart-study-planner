using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.BehavioralLogs.Services;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.FocusSessions.Dtos;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Domain.Entities;
using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.FocusSessions.Services;

public class FocusSessionService : IFocusSessionService
{
    private readonly IAppDbContext _db;
    private readonly IBehavioralLogService _behavioralLogs;
    private readonly TimeProvider _time;

    public FocusSessionService(IAppDbContext db, IBehavioralLogService behavioralLogs, TimeProvider time)
    {
        _db = db;
        _behavioralLogs = behavioralLogs;
        _time = time;
    }

    public async Task<IReadOnlyList<FocusSessionDto>> ListAsync(int userId, DateOnly? from, DateOnly? to, CancellationToken ct)
    {
        var rangeFrom = from ?? DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime).AddDays(-7);
        var rangeTo = to ?? DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);

        var fromUtc = new DateTimeOffset(rangeFrom.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var toUtc = new DateTimeOffset(rangeTo.ToDateTime(TimeOnly.MaxValue), TimeSpan.Zero);

        var sessions = await _db.FocusSessions
            .Include(s => s.Subject)
            .Where(s => s.UserId == userId && s.StartedAt >= fromUtc && s.StartedAt <= toUtc)
            .OrderByDescending(s => s.StartedAt)
            .ToListAsync(ct);

        return sessions.Select(s => Map(s)).ToList();
    }

    public async Task<FocusSessionDto> StartAsync(int userId, StartSessionDto dto, CancellationToken ct)
    {
        var subject = await _db.Subjects.FirstOrDefaultAsync(s => s.UserId == userId && s.Id == dto.SubjectId, ct)
            ?? throw new NotFoundException("Subject", dto.SubjectId);

        if (dto.TaskId.HasValue)
        {
            var taskOk = await _db.StudyTasks.AnyAsync(t => t.UserId == userId && t.Id == dto.TaskId.Value, ct);
            if (!taskOk) throw new NotFoundException("Task", dto.TaskId.Value);
        }

        var session = new FocusSession
        {
            UserId = userId,
            TaskId = dto.TaskId,
            SubjectId = dto.SubjectId,
            Mode = dto.Mode,
            DurationSeconds = 0,
            StartedAt = _time.GetUtcNow()
        };
        _db.FocusSessions.Add(session);
        await _db.SaveChangesAsync(ct);

        return Map(session, subject.Name);
    }

    public async Task<FocusSessionDto> CompleteAsync(int userId, int id, CompleteSessionDto dto, CancellationToken ct)
    {
        var session = await _db.FocusSessions.Include(s => s.Subject)
            .FirstOrDefaultAsync(s => s.UserId == userId && s.Id == id, ct)
            ?? throw new NotFoundException("FocusSession", id);

        if (session.CompletedAt is not null)
        {
            throw new ConflictException("This session has already been completed.");
        }

        session.DurationSeconds = dto.DurationSeconds;
        session.FocusRating = dto.FocusRating;
        session.SnoozeReason = dto.SnoozeReason;
        session.CompletedAt = _time.GetUtcNow();

        await _db.SaveChangesAsync(ct);

        var minutes = (int)Math.Round(dto.DurationSeconds / 60.0);
        await _behavioralLogs.AddStudyMinutesAsync(userId, minutes, ct);
        await _behavioralLogs.RecordFocusRatingAsync(userId, dto.FocusRating, ct);

        if (session.TaskId.HasValue)
        {
            await UpdateTaskStreakAsync(userId, session.TaskId.Value, dto.DurationSeconds, ct);
        }

        return Map(session);
    }

    private async Task UpdateTaskStreakAsync(int userId, int taskId, int durationSeconds, CancellationToken ct)
    {
        var task = await _db.StudyTasks.FirstOrDefaultAsync(t => t.UserId == userId && t.Id == taskId, ct);
        if (task is null) return;

        task.DaysSinceLastStudy = 0;
        task.ConsecutiveDaysStudied += 1;
        
        var minutes = (int)Math.Round(durationSeconds / 60.0);
        task.ActualMinutes = (task.ActualMinutes ?? 0) + minutes;
        
        if (task.ActualMinutes >= task.EstimatedMinutes && task.Status != StudyTaskStatus.Done)
        {
            task.Status = StudyTaskStatus.Done;
            task.CompletedAt = _time.GetUtcNow();
        }

        task.UpdatedAt = _time.GetUtcNow();
        await _db.SaveChangesAsync(ct);
    }

    internal static FocusSessionDto Map(FocusSession s, string? overrideSubjectName = null) => new()
    {
        Id = s.Id,
        TaskId = s.TaskId,
        SubjectId = s.SubjectId,
        SubjectName = overrideSubjectName ?? s.Subject?.Name ?? string.Empty,
        Mode = s.Mode,
        DurationSeconds = s.DurationSeconds,
        FocusRating = s.FocusRating,
        SnoozeReason = s.SnoozeReason,
        StartedAt = s.StartedAt,
        CompletedAt = s.CompletedAt
    };
}
