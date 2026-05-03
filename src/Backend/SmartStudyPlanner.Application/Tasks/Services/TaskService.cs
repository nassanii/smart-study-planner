using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.BehavioralLogs.Services;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Application.Tasks.Dtos;
using SmartStudyPlanner.Domain.Entities;
using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Tasks.Services;

public class TaskService : ITaskService
{
    private readonly IAppDbContext _db;
    private readonly IBehavioralLogService _behavioralLogs;
    private readonly TimeProvider _time;

    public TaskService(IAppDbContext db, IBehavioralLogService behavioralLogs, TimeProvider time)
    {
        _db = db;
        _behavioralLogs = behavioralLogs;
        _time = time;
    }

    public async Task<IReadOnlyList<TaskDto>> ListAsync(int userId, TaskFilter filter, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        var query = _db.StudyTasks.Include(t => t.Subject).Where(t => t.UserId == userId);

        query = filter switch
        {
            TaskFilter.High => query.Where(t => t.Priority == TaskPriority.High && t.Status != StudyTaskStatus.Done),
            TaskFilter.Today => query.Where(t => t.Status != StudyTaskStatus.Done && (t.Deadline == today || t.Deadline == null)),
            TaskFilter.Done => query.Where(t => t.Status == StudyTaskStatus.Done),
            _ => query
        };

        var list = await query.OrderBy(t => t.Status).ThenBy(t => t.Priority).ThenBy(t => t.Deadline).ToListAsync(ct);
        return list.Select(Map).ToList();
    }

    public async Task<TaskDto> GetAsync(int userId, int id, CancellationToken ct)
    {
        var t = await LoadAsync(userId, id, ct);
        return Map(t);
    }

    public async Task<TaskDto> CreateAsync(int userId, NewTaskDto dto, CancellationToken ct)
    {
        var subjectExists = await _db.Subjects.AnyAsync(s => s.UserId == userId && s.Id == dto.SubjectId, ct);
        if (!subjectExists) throw new NotFoundException("Subject", dto.SubjectId);

        var now = _time.GetUtcNow();
        var entity = new StudyTask
        {
            UserId = userId,
            SubjectId = dto.SubjectId,
            Title = string.IsNullOrWhiteSpace(dto.Title) ? "Study Session" : dto.Title,
            Priority = dto.Priority,
            DifficultyRating = dto.DifficultyRating,
            EstimatedMinutes = dto.EstimatedMinutes,
            Status = StudyTaskStatus.Upcoming,
            Deadline = dto.Deadline,
            Tag = dto.Tag,
            DaysSinceLastStudy = 0,
            ConsecutiveDaysStudied = 0,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.StudyTasks.Add(entity);
        await _db.SaveChangesAsync(ct);

        await _db.Entry(entity).Reference(e => e.Subject).LoadAsync(ct);
        return Map(entity);
    }

    public async Task<TaskDto> UpdateAsync(int userId, int id, UpdateTaskDto dto, CancellationToken ct)
    {
        var t = await LoadAsync(userId, id, ct);
        if (dto.SubjectId.HasValue)
        {
            var ok = await _db.Subjects.AnyAsync(s => s.UserId == userId && s.Id == dto.SubjectId.Value, ct);
            if (!ok) throw new NotFoundException("Subject", dto.SubjectId.Value);
            t.SubjectId = dto.SubjectId.Value;
        }
        if (dto.Priority.HasValue) t.Priority = dto.Priority.Value;
        if (dto.DifficultyRating.HasValue) t.DifficultyRating = dto.DifficultyRating.Value;
        if (dto.EstimatedMinutes.HasValue) t.EstimatedMinutes = dto.EstimatedMinutes.Value;
        if (dto.Deadline.HasValue) t.Deadline = dto.Deadline;
        if (dto.Tag is not null) t.Tag = dto.Tag;
        if (dto.Status.HasValue) t.Status = dto.Status.Value;
        t.UpdatedAt = _time.GetUtcNow();

        await _db.SaveChangesAsync(ct);
        await _db.Entry(t).Reference(e => e.Subject).LoadAsync(ct);
        return Map(t);
    }

    public async Task<TaskDto> UpdateDifficultyAsync(int userId, int id, short difficulty, CancellationToken ct)
    {
        var t = await LoadAsync(userId, id, ct);
        t.DifficultyRating = difficulty;
        t.UpdatedAt = _time.GetUtcNow();
        await _db.SaveChangesAsync(ct);
        return Map(t);
    }

    public async Task<TaskDto> CompleteAsync(int userId, int id, int actualMinutes, CancellationToken ct)
    {
        var t = await LoadAsync(userId, id, ct);
        var now = _time.GetUtcNow();
        t.Status = StudyTaskStatus.Done;
        t.ActualMinutes = actualMinutes;
        t.CompletedAt = now;
        t.UpdatedAt = now;
        await _db.SaveChangesAsync(ct);
        await _behavioralLogs.AddStudyMinutesAsync(userId, actualMinutes, ct);
        return Map(t);
    }

    public async Task<TaskDto> SnoozeAsync(int userId, int id, string? reason, CancellationToken ct)
    {
        var t = await LoadAsync(userId, id, ct);
        t.Status = StudyTaskStatus.Snoozed;
        t.UpdatedAt = _time.GetUtcNow();
        await _db.SaveChangesAsync(ct);
        await _behavioralLogs.IncrementSnoozeAsync(userId, ct);
        return Map(t);
    }

    public async Task DeleteAsync(int userId, int id, CancellationToken ct)
    {
        var t = await LoadAsync(userId, id, ct);
        _db.StudyTasks.Remove(t);
        await _db.SaveChangesAsync(ct);
    }

    private async Task<StudyTask> LoadAsync(int userId, int id, CancellationToken ct)
    {
        var t = await _db.StudyTasks.Include(x => x.Subject)
            .FirstOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct);
        return t ?? throw new NotFoundException("Task", id);
    }

    internal static TaskDto Map(StudyTask t) => new()
    {
        Id = t.Id,
        SubjectId = t.SubjectId,
        Subject = t.Subject?.Name ?? string.Empty,
        Title = t.Title,
        Priority = t.Priority,
        DifficultyRating = t.DifficultyRating,
        EstimatedMinutes = t.EstimatedMinutes,
        ActualMinutes = t.ActualMinutes,
        DaysSinceLastStudy = t.DaysSinceLastStudy,
        ConsecutiveDaysStudied = t.ConsecutiveDaysStudied,
        Status = t.Status,
        Deadline = t.Deadline,
        Tag = t.Tag,
        CompletedAt = t.CompletedAt,
        CreatedAt = t.CreatedAt,
        UpdatedAt = t.UpdatedAt
    };
}
