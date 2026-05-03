using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.Ai;
using SmartStudyPlanner.Application.Analytics.Dtos;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Analytics.Services;

public class AnalyticsService : IAnalyticsService
{
    private readonly IAppDbContext _db;
    private readonly IAiClient _ai;
    private readonly TimeProvider _time;
    private readonly Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> _users;

    public AnalyticsService(
        IAppDbContext db,
        IAiClient ai,
        TimeProvider time,
        Microsoft.AspNetCore.Identity.UserManager<ApplicationUser> users)
    {
        _db = db;
        _ai = ai;
        _time = time;
        _users = users;
    }

    public async Task<InsightsDto> GetInsightsAsync(int userId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        var weekAgo = today.AddDays(-7);

        var logs = await _db.BehavioralLogs
            .Where(b => b.UserId == userId && b.Date >= weekAgo && b.Date <= today)
            .ToListAsync(ct);

        var streak = ComputeStreak(logs.Select(l => l.Date).ToHashSet(), today);
        var avgFocus = logs.Where(l => l.AvgFocusRating.HasValue).Select(l => l.AvgFocusRating!.Value).DefaultIfEmpty().Average();
        var snoozeRate = logs.Count == 0 ? 0m : Math.Round((decimal)logs.Sum(l => l.SnoozeCount) / logs.Count, 2);

        var completed = await _db.StudyTasks.CountAsync(t => t.UserId == userId && t.Status == StudyTaskStatus.Done, ct);

        var diffs = await _db.StudyTasks
            .Where(t => t.UserId == userId && t.Status == StudyTaskStatus.Done && t.ActualMinutes.HasValue)
            .Select(t => t.ActualMinutes!.Value - t.EstimatedMinutes)
            .ToListAsync(ct);
        var planningError = diffs.Count == 0 ? 0d : diffs.Average();

        var latestSchedule = await _db.AiSchedules
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.GeneratedAt)
            .Select(a => new { a.BurnoutScore, a.IsExhausted })
            .FirstOrDefaultAsync(ct);

        var user = await _users.FindByIdAsync(userId.ToString());

        var peakHoursRaw = await _db.FocusSessions
            .Where(s => s.UserId == userId && s.CompletedAt != null)
            .Select(s => s.StartedAt)
            .ToListAsync(ct);

        var peakHours = peakHoursRaw
            .GroupBy(s => s.Hour)
            .Select(g => new { Hour = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .Take(3)
            .ToList();

        var badges = new List<string>();
        if (streak >= 7) badges.Add("Consistent");
        if (avgFocus >= 4.5m) badges.Add("Deep Focus");
        if (logs.Where(l => l.Date == today).Sum(l => l.StudyHours) >= 4m) badges.Add("Hard Worker");
        if (completed >= 10) badges.Add("Achiever");

        var weeklyData = new Dictionary<string, decimal>();
        for (int i = 6; i >= 0; i--)
        {
            var date = today.AddDays(-i);
            var hours = (decimal)logs.Where(l => l.Date == date).Sum(l => (double)l.StudyHours);
            weeklyData[date.ToString("ddd")] = hours;
        }

        return new InsightsDto
        {
            DayStreak = streak,
            AvgFocusRating = avgFocus == 0 ? null : Math.Round(avgFocus, 2),
            SnoozeRatePerDay = snoozeRate,
            CompletedTasks = completed,
            PlanningErrorMinutes = (int)Math.Round(planningError),
            LatestBurnout = latestSchedule is null ? null : latestSchedule.BurnoutScore,
            LatestIsExhausted = latestSchedule?.IsExhausted ?? false,
            PeakHourBuckets = peakHours.Select(p => p.Hour).ToList(),
            StudyHoursToday = (decimal)logs.Where(l => l.Date == today).Sum(l => l.StudyHours),
            Badges = badges,
            WeeklyStudyData = weeklyData
        };
    }

    public async Task<JsonElement?> GetAiPerformanceAsync(int userId, CancellationToken ct)
        => await _ai.GetPerformanceAsync(userId, ct);

    internal static int ComputeStreak(HashSet<DateOnly> dates, DateOnly today)
    {
        var streak = 0;
        var cursor = today;
        while (dates.Contains(cursor))
        {
            streak++;
            cursor = cursor.AddDays(-1);
        }
        return streak;
    }
}
