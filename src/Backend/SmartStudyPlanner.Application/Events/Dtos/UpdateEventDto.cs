namespace SmartStudyPlanner.Application.Events.Dtos;

public class UpdateEventDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public DateOnly? Date { get; set; }
    public TimeOnly? StartTime { get; set; }
    public int? EstimatedMinutes { get; set; }
    public int? Priority { get; set; }
    public bool? IsCompleted { get; set; }
}
