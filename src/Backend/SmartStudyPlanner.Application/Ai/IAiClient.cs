using System.Text.Json;
using SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

namespace SmartStudyPlanner.Application.Ai;

public interface IAiClient
{
    Task<AiOptimizeResponseDto> OptimizeScheduleAsync(AiOptimizeRequestDto request, CancellationToken ct);
    Task<JsonElement?> GetPerformanceAsync(int userId, CancellationToken ct);
    Task<bool> PingAsync(CancellationToken ct);
}
