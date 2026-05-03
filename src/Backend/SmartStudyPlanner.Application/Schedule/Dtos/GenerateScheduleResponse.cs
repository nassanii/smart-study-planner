using System.Text.Json.Serialization;
using SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;
using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Schedule.Dtos;

public class GenerateScheduleResponse
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("generated_at")] public DateTimeOffset GeneratedAt { get; set; }
    [JsonPropertyName("mode")] public ScheduleMode Mode { get; set; }
    [JsonPropertyName("has_error")] public bool HasError { get; set; }
    [JsonPropertyName("error_message")] public string? ErrorMessage { get; set; }
    [JsonPropertyName("error_details")] public string? ErrorDetails { get; set; }
    [JsonPropertyName("analysis_results")] public AiAnalysisResultsDto AnalysisResults { get; set; } = new();
    [JsonPropertyName("ai_schedule")] public AiScheduleResultDto AiSchedule { get; set; } = new();
    [JsonPropertyName("slot_statuses")] public Dictionary<int, SlotStatusDto> SlotStatuses { get; set; } = new();
}

public class SlotStatusDto
{
    [JsonPropertyName("status")] public string Status { get; set; } = "pending"; // completed, snoozed, in_progress
    [JsonPropertyName("reason")] public string? Reason { get; set; }
}

