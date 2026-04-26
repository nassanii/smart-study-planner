using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiScheduleResultDto
{
    [JsonPropertyName("scheduled_slots")] public List<AiScheduledSlotDto> ScheduledSlots { get; set; } = new();
    [JsonPropertyName("postponed_tasks")] public List<int> PostponedTasks { get; set; } = new();
    [JsonPropertyName("ai_message")] public string? AiMessage { get; set; }
    [JsonPropertyName("error")] public string? Error { get; set; }
    [JsonPropertyName("details")] public string? Details { get; set; }
}
