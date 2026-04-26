using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiAnalysisResultsDto
{
    [JsonPropertyName("user")] public int User { get; set; }
    [JsonPropertyName("mode")] public string Mode { get; set; } = string.Empty;
    [JsonPropertyName("burnout_score")] public double BurnoutScore { get; set; }
    [JsonPropertyName("is_exhausted")] public bool IsExhausted { get; set; }
    [JsonPropertyName("difficulty_factors")] public Dictionary<string, double> DifficultyFactors { get; set; } = new();
}
