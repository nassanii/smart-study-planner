using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Domain.Entities;

public class AiSchedule
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateTimeOffset GeneratedAt { get; set; }
    public ScheduleMode Mode { get; set; }
    public decimal BurnoutScore { get; set; }
    public bool IsExhausted { get; set; }
    public string AiMessage { get; set; } = string.Empty;
    public string RequestPayload { get; set; } = "{}";
    public string ResponsePayload { get; set; } = "{}";
    public bool HasError { get; set; }
}
