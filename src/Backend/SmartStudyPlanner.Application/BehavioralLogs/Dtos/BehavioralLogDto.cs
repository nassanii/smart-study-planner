namespace SmartStudyPlanner.Application.BehavioralLogs.Dtos;

public class BehavioralLogDto
{
    public int Id { get; set; }
    public DateOnly Date { get; set; }
    public int SnoozeCount { get; set; }
    public decimal StudyHours { get; set; }
    public decimal? AvgFocusRating { get; set; }
    public List<int> LastFocusRatings { get; set; } = new();
}
