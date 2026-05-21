using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SmartStudyPlanner.Application.Ai;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Application.Schedule.Dtos;
using SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;
using SmartStudyPlanner.Application.Schedule.Mapping;
using SmartStudyPlanner.Domain.Entities;
using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Schedule.Services;

public class ScheduleService : IScheduleService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private static readonly string[] PlanReadyTitles =
    {
        "Your Plan Is Ready",
        "Today's Study Roadmap Unlocked",
        "Your Study Schedule Is Live",
        "Plan Generated — Time to Shine"
    };

    private static readonly string[] PlanReadyBodies =
    {
        "Your personalized study plan is ready. Open the app and start crushing it!",
        "Fresh schedule generated for you. Let's make today productive!",
        "Your study slots are mapped out. Time to focus and conquer.",
        "Your day is organized. Tap to see what's next on the agenda."
    };

    private readonly IAppDbContext _db;
    private readonly IAiClient _ai;
    private readonly SchedulePayloadBuilder _builder;
    private readonly TimeProvider _time;
    private readonly ILogger<ScheduleService> _log;
    private readonly IServiceProvider _serviceProvider;

    public ScheduleService(IAppDbContext db, IAiClient ai, SchedulePayloadBuilder builder, TimeProvider time, ILogger<ScheduleService> log, IServiceProvider serviceProvider)
    {
        _db = db;
        _ai = ai;
        _builder = builder;
        _time = time;
        _log = log;
        _serviceProvider = serviceProvider;
    }

    public async Task<GenerateScheduleResponse> GenerateAsync(int userId, DateOnly? date, bool useAi, CancellationToken ct)
    {
        var targetDate = date ?? DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        var request = await _builder.BuildAsync(userId, targetDate, ct);
        
        var response = useAi
            ? await GenerateWithAiAsync(userId, request, ct)
            : BuildRuleBasedSchedule(request, targetDate);

        var hasError = !string.IsNullOrEmpty(response.AiSchedule.Error);
        var mode = ParseMode(response.AnalysisResults.Mode);

        var generationTime = _time.GetUtcNow();
        var targetDateTime = targetDate.ToDateTime(TimeOnly.FromTimeSpan(generationTime.TimeOfDay));
        var targetGeneratedAt = new DateTimeOffset(targetDateTime, generationTime.Offset);

        var entity = new AiSchedule
        {
            UserId = userId,
            GeneratedAt = targetGeneratedAt,
            Mode = mode,
            BurnoutScore = (decimal)response.AnalysisResults.BurnoutScore,
            IsExhausted = response.AnalysisResults.IsExhausted,
            AiMessage = response.AiSchedule.AiMessage ?? response.AiSchedule.Error ?? string.Empty,
            RequestPayload = JsonSerializer.Serialize(request, JsonOptions),
            ResponsePayload = JsonSerializer.Serialize(response, JsonOptions),
            HasError = hasError
        };
        _db.AiSchedules.Add(entity);
        await _db.SaveChangesAsync(ct);

        if (hasError)
        {
            _log.LogWarning("AI returned error for user {UserId}: {Error}", userId, response.AiSchedule.Error);
        }
        else
        {
            _ = SendPlanReadyNotificationAsync(userId);
        }

        return new GenerateScheduleResponse
        {
            Id = entity.Id,
            GeneratedAt = entity.GeneratedAt,
            Mode = mode,
            HasError = hasError,
            ErrorMessage = response.AiSchedule.Error,
            ErrorDetails = response.AiSchedule.Details,
            AnalysisResults = response.AnalysisResults,
            AiSchedule = response.AiSchedule,
            SlotStatuses = new()
        };
    }

    private async Task<AiOptimizeResponseDto> GenerateWithAiAsync(int userId, AiOptimizeRequestDto request, CancellationToken ct)
    {
        try
        {
            return await _ai.OptimizeScheduleAsync(request, ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "AI optimization failed for user {UserId}", userId);
            return new AiOptimizeResponseDto
            {
                AiSchedule = new AiScheduleResultDto { Error = "AI service unavailable", Details = ex.Message },
                AnalysisResults = new AiAnalysisResultsDto { Mode = "Cold Start", BurnoutScore = 0 }
            };
        }
    }

    private static AiOptimizeResponseDto BuildRuleBasedSchedule(AiOptimizeRequestDto request, DateOnly targetDate)
    {
        if (request.AvailableSlots.Count == 0)
        {
            return RuleBasedError("Add at least one study time block before creating a plan.");
        }

        var items = request.CurrentTasksToPlan
            .Select(t => new PlannerItem
            {
                TaskId = t.Id,
                Subject = t.Subject,
                RemainingMinutes = Math.Clamp(t.EstimatedMinutes <= 0 ? 25 : t.EstimatedMinutes, 15, 180),
                Difficulty = Math.Clamp(t.DifficultyRating, 1, 10),
                Priority = Math.Clamp(t.Priority, 1, 3),
                Deadline = t.Deadline,
                DaysSinceLastStudy = Math.Max(0, t.DaysSinceLastStudy),
                ActivityType = string.Equals(t.Tag, "review", StringComparison.OrdinalIgnoreCase) ? "review" : "study"
            })
            .ToList();

        if (items.Count == 0)
        {
            items = request.Subjects
                .Select(s => new PlannerItem
                {
                    Subject = s.Name,
                    RemainingMinutes = 45,
                    Difficulty = Math.Clamp(s.Difficulty, 1, 10),
                    Priority = Math.Clamp(s.Priority, 1, 3),
                    Deadline = s.ExamDate,
                    ActivityType = "study"
                })
                .ToList();
        }

        if (items.Count == 0)
        {
            return RuleBasedError("Add at least one course before creating a plan.");
        }

        var slots = new List<AiScheduledSlotDto>();
        foreach (var slot in request.AvailableSlots)
        {
            if (!TimeOnly.TryParse(slot.StartTime, out var cursor) || !TimeOnly.TryParse(slot.EndTime, out var end) || end <= cursor)
            {
                continue;
            }

            while (end > cursor && (end - cursor).TotalMinutes >= 15)
            {
                var item = items
                    .Where(i => i.RemainingMinutes > 0)
                    .OrderByDescending(i => i.Score(targetDate))
                    .ThenBy(i => i.Deadline ?? DateOnly.MaxValue)
                    .FirstOrDefault();

                if (item is null) break;

                var available = (int)(end - cursor).TotalMinutes;
                var duration = Math.Min(Math.Min(50, item.RemainingMinutes), available);
                if (duration < 15) break;

                var next = cursor.AddMinutes(duration);
                slots.Add(new AiScheduledSlotDto
                {
                    TimeSlot = $"{cursor:HH\\:mm}-{next:HH\\:mm}",
                    Subject = item.Subject,
                    AdjustedDurationMinutes = duration,
                    ActivityType = item.ActivityType,
                    TaskId = item.TaskId
                });

                item.RemainingMinutes -= duration;
                cursor = next;

                if ((end - cursor).TotalMinutes >= 20 && items.Any(i => i.RemainingMinutes > 0))
                {
                    var breakEnd = cursor.AddMinutes(10);
                    slots.Add(new AiScheduledSlotDto
                    {
                        TimeSlot = $"{cursor:HH\\:mm}-{breakEnd:HH\\:mm}",
                        Subject = "Break",
                        AdjustedDurationMinutes = 10,
                        ActivityType = "break"
                    });
                    cursor = breakEnd;
                }
            }
        }

        if (slots.Count == 0)
        {
            return RuleBasedError("Your time blocks are too short. Add a block of at least 15 minutes.");
        }

        return new AiOptimizeResponseDto
        {
            Status = "ok",
            AnalysisResults = new AiAnalysisResultsDto
            {
                Mode = "Rule Based",
                BurnoutScore = 0,
                IsExhausted = false
            },
            AiSchedule = new AiScheduleResultDto
            {
                ScheduledSlots = slots,
                AiMessage = "Plan created without AI. Use AI Optimize if you want a smarter second pass."
            }
        };
    }

    private static AiOptimizeResponseDto RuleBasedError(string message) => new()
    {
        Status = "error",
        AnalysisResults = new AiAnalysisResultsDto { Mode = "Rule Based", BurnoutScore = 0 },
        AiSchedule = new AiScheduleResultDto { Error = message, Details = message }
    };

    private sealed class PlannerItem
    {
        public int? TaskId { get; set; }
        public string Subject { get; set; } = string.Empty;
        public int RemainingMinutes { get; set; }
        public int Difficulty { get; set; }
        public int Priority { get; set; }
        public DateOnly? Deadline { get; set; }
        public int DaysSinceLastStudy { get; set; }
        public string ActivityType { get; set; } = "study";

        public int Score(DateOnly targetDate)
        {
            var priorityScore = (4 - Priority) * 20;
            var difficultyScore = Difficulty * 4;
            var staleScore = Math.Min(20, DaysSinceLastStudy * 3);
            var dueScore = 0;

            if (Deadline.HasValue)
            {
                var days = Deadline.Value.DayNumber - targetDate.DayNumber;
                dueScore = days < 0 ? 60 : Math.Max(0, 35 - (days * 4));
            }

            return priorityScore + difficultyScore + staleScore + dueScore;
        }
    }

    public async Task UpdateSlotStatusAsync(int userId, int scheduleId, int slotIndex, SlotStatusDto status, CancellationToken ct)
    {
        var entity = await _db.AiSchedules.FirstOrDefaultAsync(a => a.UserId == userId && a.Id == scheduleId, ct)
            ?? throw new NotFoundException("AiSchedule", scheduleId);

        var statuses = JsonSerializer.Deserialize<Dictionary<int, SlotStatusDto>>(entity.SlotStatusesJson, JsonOptions) 
            ?? new Dictionary<int, SlotStatusDto>();
            
        statuses[slotIndex] = status;
        entity.SlotStatusesJson = JsonSerializer.Serialize(statuses, JsonOptions);
        
        await _db.SaveChangesAsync(ct);
    }

    public async Task<GenerateScheduleResponse?> GetTodayAsync(int userId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        return await GetByDateAsync(userId, today, ct);
    }

    public async Task<GenerateScheduleResponse?> GetByDateAsync(int userId, DateOnly date, CancellationToken ct)
    {
        var startUtc = new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var endUtc = startUtc.AddDays(1);

        var entity = await _db.AiSchedules
            .Where(a => a.UserId == userId && a.GeneratedAt >= startUtc && a.GeneratedAt < endUtc && !a.HasError)
            .OrderByDescending(a => a.GeneratedAt)
            .FirstOrDefaultAsync(ct);

        if (entity is null) return null;

        var response = JsonSerializer.Deserialize<AiOptimizeResponseDto>(entity.ResponsePayload, JsonOptions)
            ?? new AiOptimizeResponseDto();

        return new GenerateScheduleResponse
        {
            Id = entity.Id,
            GeneratedAt = entity.GeneratedAt,
            Mode = entity.Mode,
            HasError = entity.HasError,
            ErrorMessage = response.AiSchedule.Error,
            ErrorDetails = response.AiSchedule.Details,
            AnalysisResults = response.AnalysisResults,
            AiSchedule = response.AiSchedule,
            SlotStatuses = JsonSerializer.Deserialize<Dictionary<int, SlotStatusDto>>(entity.SlotStatusesJson, JsonOptions) ?? new()
        };
    }

    public async Task<IReadOnlyList<ScheduleSummaryDto>> GetHistoryAsync(int userId, int limit, CancellationToken ct)
    {
        if (limit <= 0) limit = 10;
        if (limit > 50) limit = 50;

        return await _db.AiSchedules
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.GeneratedAt)
            .Take(limit)
            .Select(a => new ScheduleSummaryDto
            {
                Id = a.Id,
                GeneratedAt = a.GeneratedAt,
                Mode = a.Mode,
                BurnoutScore = a.BurnoutScore,
                IsExhausted = a.IsExhausted,
                HasError = a.HasError,
                AiMessage = a.AiMessage
            })
            .ToListAsync(ct);
    }

    private async Task SendPlanReadyNotificationAsync(int userId)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user is null || string.IsNullOrWhiteSpace(user.PushToken)) return;

            var random = Random.Shared;
            var title = PlanReadyTitles[random.Next(PlanReadyTitles.Length)];
            var body = PlanReadyBodies[random.Next(PlanReadyBodies.Length)];

            await notificationService.SendNotificationAsync(user.PushToken, title, body, CancellationToken.None);
        }
        catch
        {
        }
    }

    internal static ScheduleMode ParseMode(string raw)
    {
        if (string.IsNullOrEmpty(raw)) return ScheduleMode.ColdStart;
        if (raw.Contains("Cold Start", StringComparison.OrdinalIgnoreCase)) return ScheduleMode.ColdStart;
        if (raw.Contains("Machine Learning", StringComparison.OrdinalIgnoreCase)) return ScheduleMode.Ml;
        return ScheduleMode.ColdStart;
    }
}
