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

        if (dto.DayOfWeek.HasValue)
        {
            s.DayOfWeek = dto.DayOfWeek;
            s.Date = null;
        }
        else if (dto.Date.HasValue)
        {
            s.Date = dto.Date;
            s.DayOfWeek = null;
        }
        if (dto.StartTime.HasValue) s.StartTime = dto.StartTime.Value;
        if (dto.EndTime.HasValue) s.EndTime = dto.EndTime.Value;

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
}
