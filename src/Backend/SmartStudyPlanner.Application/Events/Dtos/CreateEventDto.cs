namespace SmartStudyPlanner.Application.Events.Dtos;

public class CreateEventDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly Date { get; set; }
    public TimeOnly StartTime { get; set; }
    public int EstimatedMinutes { get; set; }
    public int Priority { get; set; }
}
