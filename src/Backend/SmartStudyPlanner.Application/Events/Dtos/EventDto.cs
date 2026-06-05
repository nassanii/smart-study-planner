namespace SmartStudyPlanner.Application.Events.Dtos;

public class EventDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly Date { get; set; }
    public TimeOnly StartTime { get; set; }
    public int EstimatedMinutes { get; set; }
    public int Priority { get; set; }
    public bool IsCompleted { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
