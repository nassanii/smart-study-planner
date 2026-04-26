using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.Tasks.Dtos;

public class UpdateTaskDto
{
    public int? SubjectId { get; set; }
    public TaskPriority? Priority { get; set; }
    public short? DifficultyRating { get; set; }
    public int? EstimatedMinutes { get; set; }
    public DateOnly? Deadline { get; set; }
    public string? Tag { get; set; }
    public StudyTaskStatus? Status { get; set; }
}
