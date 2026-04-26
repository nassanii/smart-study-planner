namespace SmartStudyPlanner.Domain.Entities;

public class BehavioralLog
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DateOnly Date { get; set; }
    public int SnoozeCount { get; set; }
    public decimal StudyHours { get; set; }
    public decimal? AvgFocusRating { get; set; }
    public string LastFocusRatingsJson { get; set; } = "[]";
}
