using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

namespace SmartStudyPlanner.Infrastructure.Services;

public class NotificationSchedulerService : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    private readonly IServiceProvider _services;
    private readonly ILogger<NotificationSchedulerService> _logger;
    private readonly TimeProvider _time;

    private DateOnly? _lastDailyCheckDate;
    private DateOnly _slotTrackerDate;
    private readonly HashSet<string> _notifiedSlots = new();

    public NotificationSchedulerService(
        IServiceProvider services,
        ILogger<NotificationSchedulerService> logger,
        TimeProvider time)
    {
        _services = services;
        _logger = logger;
        _time = time;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Notification Scheduler Service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var now = _time.GetUtcNow();
                var today = DateOnly.FromDateTime(now.LocalDateTime);

                if (_slotTrackerDate != today)
                {
                    _notifiedSlots.Clear();
                    _slotTrackerDate = today;
                }

                if (_lastDailyCheckDate != today && now.LocalDateTime.Hour >= 8)
                {
                    _logger.LogInformation("Running daily notification checks for {Date}", today);
                    await RunDailyChecksAsync(today, stoppingToken);
                    _lastDailyCheckDate = today;
                }

                await RunSlotReminderChecksAsync(now, today, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred executing notification checks.");
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }

    private async Task RunDailyChecksAsync(DateOnly today, CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var users = await userManager.Users
            .Where(u => u.IsOnboarded && u.PushToken != null)
            .ToListAsync(ct);

        foreach (var user in users)
        {
            if (string.IsNullOrWhiteSpace(user.PushToken)) continue;

            var startOfToday = new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            var endOfToday = new DateTimeOffset(today.ToDateTime(TimeOnly.MaxValue), TimeSpan.Zero);

            var planGeneratedToday = await db.AiSchedules
                .AnyAsync(s => s.UserId == user.Id && s.GeneratedAt >= startOfToday && s.GeneratedAt <= endOfToday, ct);

            if (!planGeneratedToday)
            {
                await notificationService.SendNotificationAsync(
                    user.PushToken,
                    "Daily Study Plan Nudge",
                    "Ready for today's studies? Open the app to view or generate your AI-optimized schedule.",
                    ct
                );
            }

            var tomorrow = today.AddDays(1);
            var tasksDueTomorrow = await db.StudyTasks
                .Where(t => t.UserId == user.Id && t.Deadline == tomorrow && t.Status != Domain.Enums.StudyTaskStatus.Done)
                .ToListAsync(ct);

            foreach (var task in tasksDueTomorrow)
            {
                await notificationService.SendNotificationAsync(
                    user.PushToken,
                    "Task Due Tomorrow",
                    $"Reminder: '{task.Title}' is due tomorrow. Tap to start a focus session for it.",
                    ct
                );
            }
        }
    }

    private async Task RunSlotReminderChecksAsync(DateTimeOffset now, DateOnly today, CancellationToken ct)
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var startOfToday = new DateTimeOffset(today.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var endOfToday = new DateTimeOffset(today.ToDateTime(TimeOnly.MaxValue), TimeSpan.Zero);

        var users = await userManager.Users
            .Where(u => u.IsOnboarded && u.PushToken != null)
            .ToListAsync(ct);

        foreach (var user in users)
        {
            if (string.IsNullOrWhiteSpace(user.PushToken)) continue;

            var schedule = await db.AiSchedules
                .Where(s => s.UserId == user.Id && s.GeneratedAt >= startOfToday && s.GeneratedAt <= endOfToday && !s.HasError)
                .OrderByDescending(s => s.GeneratedAt)
                .FirstOrDefaultAsync(ct);

            if (schedule is null || string.IsNullOrWhiteSpace(schedule.ResponsePayload)) continue;

            AiOptimizeResponseDto? response;
            try
            {
                response = JsonSerializer.Deserialize<AiOptimizeResponseDto>(schedule.ResponsePayload, JsonOptions);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Failed to parse AiSchedule {ScheduleId} response payload.", schedule.Id);
                continue;
            }

            var slots = response?.AiSchedule.ScheduledSlots;
            if (slots is null || slots.Count == 0) continue;

            var nowLocal = now.LocalDateTime;

            for (var i = 0; i < slots.Count; i++)
            {
                var slot = slots[i];
                if (!TryParseSlotStart(slot.TimeSlot, out var startTime)) continue;

                var slotStartLocal = today.ToDateTime(startTime);
                var minutesUntilStart = (slotStartLocal - nowLocal).TotalMinutes;

                if (minutesUntilStart <= 4 || minutesUntilStart > 5) continue;

                var trackerKey = $"{schedule.Id}:{i}";
                if (!_notifiedSlots.Add(trackerKey)) continue;

                var subject = string.IsNullOrWhiteSpace(slot.Subject) ? "your next study slot" : slot.Subject;
                await notificationService.SendNotificationAsync(
                    user.PushToken,
                    "Study Slot Starting Soon",
                    $"Heads up: '{subject}' starts in 5 minutes. Get ready to focus!",
                    ct
                );
            }
        }
    }

    private static bool TryParseSlotStart(string timeSlot, out TimeOnly start)
    {
        start = default;
        if (string.IsNullOrWhiteSpace(timeSlot)) return false;

        var dash = timeSlot.IndexOf('-');
        var startPart = (dash >= 0 ? timeSlot[..dash] : timeSlot).Trim();

        return TimeOnly.TryParse(startPart, out start);
    }
}
