using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiSlotDto
{
    [JsonPropertyName("start_time")] public string StartTime { get; set; } = string.Empty;
    [JsonPropertyName("end_time")] public string EndTime { get; set; } = string.Empty;
}
