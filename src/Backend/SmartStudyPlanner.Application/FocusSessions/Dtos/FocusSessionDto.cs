using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.FocusSessions.Dtos;

public class FocusSessionDto
{
    public int Id { get; set; }
    public int? TaskId { get; set; }
    public int SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public FocusMode Mode { get; set; }
    public int DurationSeconds { get; set; }
    public short? FocusRating { get; set; }
    public string? SnoozeReason { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
