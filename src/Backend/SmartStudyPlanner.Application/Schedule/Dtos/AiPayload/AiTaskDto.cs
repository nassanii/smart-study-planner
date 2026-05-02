using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiTaskDto
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("subject")] public string Subject { get; set; } = string.Empty;
    [JsonPropertyName("priority")] public int Priority { get; set; }
    [JsonPropertyName("difficulty_rating")] public int DifficultyRating { get; set; }
    [JsonPropertyName("days_since_last_study")] public int DaysSinceLastStudy { get; set; }
    [JsonPropertyName("consecutive_days_studied")] public int ConsecutiveDaysStudied { get; set; }
    [JsonPropertyName("estimated_minutes")] public int EstimatedMinutes { get; set; }
    [JsonPropertyName("actual_minutes")] public int ActualMinutes { get; set; }
    [JsonPropertyName("deadline")] public DateOnly? Deadline { get; set; }
    [JsonPropertyName("tag")] public string? Tag { get; set; }
}
