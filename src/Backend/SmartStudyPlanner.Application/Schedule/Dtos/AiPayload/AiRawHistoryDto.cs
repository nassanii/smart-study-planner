using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiRawHistoryDto
{
    [JsonPropertyName("recent_tasks")] public List<AiRecentTaskDto> RecentTasks { get; set; } = new();
    [JsonPropertyName("behavioral_logs")] public AiBehavioralLogsDto BehavioralLogs { get; set; } = new();
}
