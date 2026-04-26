using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Tasks.Dtos;

public class TaskDto
{
    public int Id { get; set; }
    public int SubjectId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public TaskPriority Priority { get; set; }
    public short DifficultyRating { get; set; }
    public int EstimatedMinutes { get; set; }
    public int? ActualMinutes { get; set; }
    public int DaysSinceLastStudy { get; set; }
    public int ConsecutiveDaysStudied { get; set; }
    public StudyTaskStatus Status { get; set; }
    public DateOnly? Deadline { get; set; }
    public string? Tag { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
