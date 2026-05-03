using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Tasks.Dtos;

public class NewTaskDto
{
    public int SubjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public TaskPriority Priority { get; set; } = TaskPriority.Medium;
    public short DifficultyRating { get; set; }
    public int EstimatedMinutes { get; set; }
    public DateOnly? Deadline { get; set; }
    public string? Tag { get; set; }
}
