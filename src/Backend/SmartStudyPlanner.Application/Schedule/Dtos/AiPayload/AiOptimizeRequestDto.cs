using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiOptimizeRequestDto
{
    [JsonPropertyName("user_id")] public int UserId { get; set; }
    [JsonPropertyName("deadline")] public string Deadline { get; set; } = string.Empty;
    [JsonPropertyName("raw_history")] public AiRawHistoryDto RawHistory { get; set; } = new();
    [JsonPropertyName("current_tasks_to_plan")] public List<AiTaskDto> CurrentTasksToPlan { get; set; } = new();
    [JsonPropertyName("subjects")] public List<AiSubjectDto> Subjects { get; set; } = new();
    [JsonPropertyName("available_slots")] public List<AiSlotDto> AvailableSlots { get; set; } = new();
}
