using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Domain.Entities;

public class FocusSession
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int? TaskId { get; set; }
    public int SubjectId { get; set; }
    public FocusMode Mode { get; set; }
    public int DurationSeconds { get; set; }
    public short? FocusRating { get; set; }
    public string? SnoozeReason { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public StudyTask? Task { get; set; }
    public Subject? Subject { get; set; }
}
