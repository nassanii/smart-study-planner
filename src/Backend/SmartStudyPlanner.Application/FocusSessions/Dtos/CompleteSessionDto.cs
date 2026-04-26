namespace SmartStudyPlanner.Application.FocusSessions.Dtos;

public class CompleteSessionDto
{
    public int DurationSeconds { get; set; }
    public short FocusRating { get; set; }
    public string? SnoozeReason { get; set; }
}
