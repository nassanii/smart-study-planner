using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Tasks.Dtos;

public class UpdateTaskDto
{
    public int? SubjectId { get; set; }
    public string? Title { get; set; }
    public TaskPriority? Priority { get; set; }
    public short? DifficultyRating { get; set; }
    public int? EstimatedMinutes { get; set; }
    public DateOnly? Deadline { get; set; }
    public TimeOnly? StartTime { get; set; }
    public TaskType? TaskType { get; set; }
    public bool? IsManual { get; set; }
    public string? Tag { get; set; }
    public StudyTaskStatus? Status { get; set; }
}
