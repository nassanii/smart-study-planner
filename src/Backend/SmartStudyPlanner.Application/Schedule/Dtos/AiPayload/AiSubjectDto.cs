using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiSubjectDto
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
    [JsonPropertyName("difficulty")] public int Difficulty { get; set; }
    [JsonPropertyName("priority")] public int Priority { get; set; }
}
