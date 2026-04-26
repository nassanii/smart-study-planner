using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiOptimizeResponseDto
{
    [JsonPropertyName("status")] public string Status { get; set; } = string.Empty;
    [JsonPropertyName("analysis_results")] public AiAnalysisResultsDto AnalysisResults { get; set; } = new();
    [JsonPropertyName("ai_schedule")] public AiScheduleResultDto AiSchedule { get; set; } = new();
}
