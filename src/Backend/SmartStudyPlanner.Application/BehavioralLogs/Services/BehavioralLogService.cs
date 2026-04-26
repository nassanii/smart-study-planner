using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.BehavioralLogs.Dtos;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.BehavioralLogs.Services;

public class BehavioralLogService : IBehavioralLogService
{
    private const int LastFocusRatingsCapacity = 10;

    private readonly IAppDbContext _db;
    private readonly TimeProvider _time;

    public BehavioralLogService(IAppDbContext db, TimeProvider time)
    {
        _db = db;
        _time = time;
    }

    public async Task<BehavioralLog> GetOrCreateForDateAsync(int userId, DateOnly date, CancellationToken ct)
    {
        var log = await _db.BehavioralLogs.FirstOrDefaultAsync(b => b.UserId == userId && b.Date == date, ct);
        if (log is not null) return log;

        log = new BehavioralLog
        {
            UserId = userId,
            Date = date,
            SnoozeCount = 0,
            StudyHours = 0m,
            AvgFocusRating = null,
            LastFocusRatingsJson = "[]"
        };
        _db.BehavioralLogs.Add(log);
        await _db.SaveChangesAsync(ct);
        return log;
    }

    public async Task IncrementSnoozeAsync(int userId, CancellationToken ct)
    {
        var today = TodayLocal();
        var log = await GetOrCreateForDateAsync(userId, today, ct);
        log.SnoozeCount += 1;
        await _db.SaveChangesAsync(ct);
    }

    public async Task AddStudyMinutesAsync(int userId, int minutes, CancellationToken ct)
    {
        var today = TodayLocal();
        var log = await GetOrCreateForDateAsync(userId, today, ct);
        var hours = Math.Round((decimal)minutes / 60m, 2);
        log.StudyHours = Math.Round(log.StudyHours + hours, 2);
        await _db.SaveChangesAsync(ct);
    }

    public async Task RecordFocusRatingAsync(int userId, int rating, CancellationToken ct)
    {
        var today = TodayLocal();
        var log = await GetOrCreateForDateAsync(userId, today, ct);
        var ratings = ParseRatings(log.LastFocusRatingsJson);
        ratings.Add(rating);
        if (ratings.Count > LastFocusRatingsCapacity)
        {
            ratings = ratings.Skip(ratings.Count - LastFocusRatingsCapacity).ToList();
        }
        log.LastFocusRatingsJson = JsonSerializer.Serialize(ratings);
        log.AvgFocusRating = Math.Round((decimal)ratings.Average(), 2);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<BehavioralLogDto> GetTodayDtoAsync(int userId, CancellationToken ct)
    {
        var log = await GetOrCreateForDateAsync(userId, TodayLocal(), ct);
        return Map(log);
    }

    public async Task<IReadOnlyList<BehavioralLogDto>> GetRangeAsync(int userId, DateOnly from, DateOnly to, CancellationToken ct)
    {
        var logs = await _db.BehavioralLogs
            .Where(b => b.UserId == userId && b.Date >= from && b.Date <= to)
            .OrderBy(b => b.Date)
            .ToListAsync(ct);
        return logs.Select(Map).ToList();
    }

    private DateOnly TodayLocal() => DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);

    internal static BehavioralLogDto Map(BehavioralLog b) => new()
    {
        Id = b.Id,
        Date = b.Date,
        SnoozeCount = b.SnoozeCount,
        StudyHours = b.StudyHours,
        AvgFocusRating = b.AvgFocusRating,
        LastFocusRatings = ParseRatings(b.LastFocusRatingsJson)
    };

    internal static List<int> ParseRatings(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<List<int>>(json) ?? new();
        }
        catch
        {
            return new();
        }
    }
}
