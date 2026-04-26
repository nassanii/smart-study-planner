using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Schedule.Dtos;

public class ScheduleSummaryDto
{
    public int Id { get; set; }
    public DateTimeOffset GeneratedAt { get; set; }
    public ScheduleMode Mode { get; set; }
    public decimal BurnoutScore { get; set; }
    public bool IsExhausted { get; set; }
    public bool HasError { get; set; }
    public string AiMessage { get; set; } = string.Empty;
}
