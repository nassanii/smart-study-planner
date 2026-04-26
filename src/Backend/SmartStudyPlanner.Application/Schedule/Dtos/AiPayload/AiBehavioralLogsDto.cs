using System.Text.Json.Serialization;

namespace SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

public class AiBehavioralLogsDto
{
    [JsonPropertyName("snooze_count_today")] public int SnoozeCountToday { get; set; }
    [JsonPropertyName("last_focus_ratings")] public List<int> LastFocusRatings { get; set; } = new();
    [JsonPropertyName("study_hours_today")] public double StudyHoursToday { get; set; }
}
