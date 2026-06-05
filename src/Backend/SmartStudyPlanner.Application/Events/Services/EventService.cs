using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Events.Dtos;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.Events.Services;

public class EventService : IEventService
{
    private readonly IAppDbContext _db;
    private readonly TimeProvider _time;

    public EventService(IAppDbContext db, TimeProvider time)
    {
        _db = db;
        _time = time;
    }

    public async Task<List<EventDto>> ListAsync(int userId, CancellationToken ct = default)
    {
        var events = await _db.AppEvents
            .Where(e => e.UserId == userId)
            .OrderBy(e => e.Date)
            .ThenBy(e => e.StartTime)
            .ToListAsync(ct);

        return events.Select(MapToDto).ToList();
    }

    public async Task<EventDto> GetByIdAsync(int id, int userId, CancellationToken ct = default)
    {
        var ev = await _db.AppEvents
            .FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId, ct)
            ?? throw new NotFoundException("Event", id);

        return MapToDto(ev);
    }

    public async Task<EventDto> CreateAsync(int userId, CreateEventDto dto, CancellationToken ct = default)
    {
        var now = _time.GetUtcNow();

        var ev = new AppEvent
        {
            UserId = userId,
            Title = dto.Title,
            Description = dto.Description,
            Date = dto.Date,
            StartTime = dto.StartTime,
            EstimatedMinutes = dto.EstimatedMinutes,
            Priority = dto.Priority,
            IsCompleted = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.AppEvents.Add(ev);
        await _db.SaveChangesAsync(ct);

        return MapToDto(ev);
    }

    public async Task<EventDto> UpdateAsync(int id, int userId, UpdateEventDto dto, CancellationToken ct = default)
    {
        var ev = await _db.AppEvents
            .FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId, ct)
            ?? throw new NotFoundException("Event", id);

        if (dto.Title is not null) ev.Title = dto.Title;
        if (dto.Description is not null) ev.Description = dto.Description;
        if (dto.Date.HasValue) ev.Date = dto.Date.Value;
        if (dto.StartTime.HasValue) ev.StartTime = dto.StartTime.Value;
        if (dto.EstimatedMinutes.HasValue) ev.EstimatedMinutes = dto.EstimatedMinutes.Value;
        if (dto.Priority.HasValue) ev.Priority = dto.Priority.Value;
        if (dto.IsCompleted.HasValue) ev.IsCompleted = dto.IsCompleted.Value;

        ev.UpdatedAt = _time.GetUtcNow();

        await _db.SaveChangesAsync(ct);

        return MapToDto(ev);
    }

    public async Task DeleteAsync(int id, int userId, CancellationToken ct = default)
    {
        var ev = await _db.AppEvents
            .FirstOrDefaultAsync(e => e.Id == id && e.UserId == userId, ct)
            ?? throw new NotFoundException("Event", id);

        _db.AppEvents.Remove(ev);
        await _db.SaveChangesAsync(ct);
    }

    private static EventDto MapToDto(AppEvent e) => new EventDto
    {
        Id = e.Id,
        Title = e.Title,
        Description = e.Description,
        Date = e.Date,
        StartTime = e.StartTime,
        EstimatedMinutes = e.EstimatedMinutes,
        Priority = e.Priority,
        IsCompleted = e.IsCompleted,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt
    };
}
