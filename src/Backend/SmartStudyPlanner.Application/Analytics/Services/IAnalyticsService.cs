using System.Text.Json;
using SmartStudyPlanner.Application.Analytics.Dtos;

namespace SmartStudyPlanner.Application.Analytics.Services;

public interface IAnalyticsService
{
    Task<InsightsDto> GetInsightsAsync(int userId, CancellationToken ct);
    Task<JsonElement?> GetAiPerformanceAsync(int userId, CancellationToken ct);
}
