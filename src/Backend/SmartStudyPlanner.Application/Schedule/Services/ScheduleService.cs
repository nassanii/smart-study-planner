using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SmartStudyPlanner.Application.Ai;
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

    private readonly IAppDbContext _db;
    private readonly IAiClient _ai;
    private readonly SchedulePayloadBuilder _builder;
    private readonly TimeProvider _time;
    private readonly ILogger<ScheduleService> _log;

    public ScheduleService(IAppDbContext db, IAiClient ai, SchedulePayloadBuilder builder, TimeProvider time, ILogger<ScheduleService> log)
    {
        _db = db;
        _ai = ai;
        _builder = builder;
        _time = time;
        _log = log;
    }

    public async Task<GenerateScheduleResponse> GenerateAsync(int userId, DateOnly? date, CancellationToken ct)
    {
        var targetDate = date ?? DateOnly.FromDateTime(_time.GetUtcNow().UtcDateTime);
        var request = await _builder.BuildAsync(userId, targetDate, ct);
        
        AiOptimizeResponseDto response;
        try
        {
            response = await _ai.OptimizeScheduleAsync(request, ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "AI optimization failed for user {UserId}", userId);
            response = new AiOptimizeResponseDto
            {
                AiSchedule = new AiScheduleResultDto { Error = "AI service unavailable", Details = ex.Message },
                AnalysisResults = new AiAnalysisResultsDto { Mode = "Cold Start", BurnoutScore = 0 }
            };
        }

        var hasError = !string.IsNullOrEmpty(response.AiSchedule.Error);
        var mode = ParseMode(response.AnalysisResults.Mode);

        var entity = new AiSchedule
        {
            UserId = userId,
            GeneratedAt = _time.GetUtcNow(),
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

        return new GenerateScheduleResponse
        {
            Id = entity.Id,
            GeneratedAt = entity.GeneratedAt,
            Mode = mode,
            HasError = hasError,
            ErrorMessage = response.AiSchedule.Error,
            ErrorDetails = response.AiSchedule.Details,
            AnalysisResults = response.AnalysisResults,
            AiSchedule = response.AiSchedule
        };
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
            AiSchedule = response.AiSchedule
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

    internal static ScheduleMode ParseMode(string raw)
    {
        if (string.IsNullOrEmpty(raw)) return ScheduleMode.ColdStart;
        if (raw.Contains("Cold Start", StringComparison.OrdinalIgnoreCase)) return ScheduleMode.ColdStart;
        if (raw.Contains("Machine Learning", StringComparison.OrdinalIgnoreCase)) return ScheduleMode.Ml;
        return ScheduleMode.ColdStart;
    }
}
