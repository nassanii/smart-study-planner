using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiRecentTaskDto
{
    [JsonPropertyName("id")] public int? Id { get; set; }
    [JsonPropertyName("subject_id")] public int SubjectId { get; set; }
    [JsonPropertyName("estimated")] public double Estimated { get; set; }
    [JsonPropertyName("actual")] public double Actual { get; set; }
    [JsonPropertyName("status")] public string Status { get; set; } = "completed";
}
