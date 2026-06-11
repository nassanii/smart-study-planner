using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.AvailableSlots.Dtos;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.AvailableSlots.Services;

public class AvailableSlotService : IAvailableSlotService
{
    private readonly IAppDbContext _db;

    public AvailableSlotService(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<AvailableSlotDto>> ListForDateAsync(int userId, DateOnly? date, CancellationToken ct)
    {
        var query = _db.AvailableSlots.Where(s => s.UserId == userId);

        if (date is null)
        {
            return await query.OrderBy(s => s.DayOfWeek).ThenBy(s => s.StartTime)
                .Select(s => Map(s)).ToListAsync(ct);
        }

        var dow = date.Value.DayOfWeek;
        var matching = await query
            .Where(s => s.Date == date || s.DayOfWeek == dow)
            .OrderBy(s => s.StartTime)
            .ToListAsync(ct);

        return matching.Select(Map).ToList();
    }

    public async Task<AvailableSlotDto> CreateAsync(int userId, NewSlotDto dto, CancellationToken ct)
    {
        await EnsureNoOverlapAsync(userId, dto.DayOfWeek, dto.Date, dto.StartTime, dto.EndTime, ct);

        var entity = new AvailableSlot
        {
            UserId = userId,
            DayOfWeek = dto.DayOfWeek,
            Date = dto.Date,
            StartTime = dto.StartTime,
            EndTime = dto.EndTime
        };
        _db.AvailableSlots.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Map(entity);
    }

    public async Task<AvailableSlotDto> UpdateAsync(int userId, int id, UpdateSlotDto dto, CancellationToken ct)
    {
        var s = await _db.AvailableSlots.FirstOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
            ?? throw new NotFoundException("AvailableSlot", id);

        var nextDayOfWeek = s.DayOfWeek;
        var nextDate = s.Date;
        var nextStart = dto.StartTime ?? s.StartTime;
        var nextEnd = dto.EndTime ?? s.EndTime;

        if (dto.DayOfWeek.HasValue)
        {
            nextDayOfWeek = dto.DayOfWeek;
            nextDate = null;
        }
        else if (dto.Date.HasValue)
        {
            nextDate = dto.Date;
            nextDayOfWeek = null;
        }

        await EnsureNoOverlapAsync(userId, nextDayOfWeek, nextDate, nextStart, nextEnd, ct, id);

        s.DayOfWeek = nextDayOfWeek;
        s.Date = nextDate;
        s.StartTime = nextStart;
        s.EndTime = nextEnd;

        await _db.SaveChangesAsync(ct);
        return Map(s);
    }

    public async Task DeleteAsync(int userId, int id, CancellationToken ct)
    {
        var s = await _db.AvailableSlots.FirstOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
            ?? throw new NotFoundException("AvailableSlot", id);
        _db.AvailableSlots.Remove(s);
        await _db.SaveChangesAsync(ct);
    }

    internal static AvailableSlotDto Map(AvailableSlot s) => new()
    {
        Id = s.Id,
        DayOfWeek = s.DayOfWeek,
        Date = s.Date,
        StartTime = s.StartTime,
        EndTime = s.EndTime
    };

    private async Task EnsureNoOverlapAsync(
        int userId,
        DayOfWeek? dayOfWeek,
        DateOnly? date,
        TimeOnly startTime,
        TimeOnly endTime,
        CancellationToken ct,
        int? ignoredSlotId = null)
    {
        var candidates = await _db.AvailableSlots
            .Where(s => s.UserId == userId && (!ignoredSlotId.HasValue || s.Id != ignoredSlotId.Value))
            .ToListAsync(ct);

        var conflict = candidates.FirstOrDefault(s =>
            IsSameScheduleScope(s, dayOfWeek, date)
            && startTime < s.EndTime
            && endTime > s.StartTime);

        if (conflict is null) return;

        throw new ConflictException(
            $"Study block overlaps with {conflict.StartTime:HH\\:mm} - {conflict.EndTime:HH\\:mm}.");
    }

    private static bool IsSameScheduleScope(AvailableSlot existing, DayOfWeek? dayOfWeek, DateOnly? date)
    {
        if (date.HasValue)
        {
            return existing.Date == date.Value || existing.DayOfWeek == date.Value.DayOfWeek;
        }

        if (dayOfWeek.HasValue)
        {
            return existing.DayOfWeek == dayOfWeek.Value
                || (existing.Date.HasValue && existing.Date.Value.DayOfWeek == dayOfWeek.Value);
        }

        return false;
    }
}
