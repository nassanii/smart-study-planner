using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiFixedBlockDto
{
    [JsonPropertyName("subject")] public string Subject { get; set; } = string.Empty;
    [JsonPropertyName("start_time")] public string StartTime { get; set; } = string.Empty; // "HH:mm"
    [JsonPropertyName("duration_minutes")] public int DurationMinutes { get; set; }
    [JsonPropertyName("topic")] public string? Topic { get; set; }
    [JsonPropertyName("task_id")] public int? TaskId { get; set; }
}
