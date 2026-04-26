using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiScheduledSlotDto
{
    [JsonPropertyName("time_slot")] public string TimeSlot { get; set; } = string.Empty;
    [JsonPropertyName("subject")] public string Subject { get; set; } = string.Empty;
    [JsonPropertyName("adjusted_duration_minutes")] public int AdjustedDurationMinutes { get; set; }
    [JsonPropertyName("activity_type")] public string ActivityType { get; set; } = "study";
    [JsonPropertyName("task_id")] public int? TaskId { get; set; }
}
