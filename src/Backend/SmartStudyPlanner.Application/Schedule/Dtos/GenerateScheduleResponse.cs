using SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;
using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Schedule.Dtos;

public class GenerateScheduleResponse
{
    public int Id { get; set; }
    public DateTimeOffset GeneratedAt { get; set; }
    public ScheduleMode Mode { get; set; }
    public bool HasError { get; set; }
    public string? ErrorMessage { get; set; }
    public string? ErrorDetails { get; set; }
    public AiAnalysisResultsDto AnalysisResults { get; set; } = new();
    public AiScheduleResultDto AiSchedule { get; set; } = new();
}
