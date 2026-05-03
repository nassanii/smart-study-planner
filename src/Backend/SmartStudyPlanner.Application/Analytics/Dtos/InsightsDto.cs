namespace SmartStudyPlanner.Application.Analytics.Dtos;

public class InsightsDto
{
    public int DayStreak { get; set; }
    public decimal? AvgFocusRating { get; set; }
    public decimal SnoozeRatePerDay { get; set; }
    public int CompletedTasks { get; set; }
    public int PlanningErrorMinutes { get; set; }
    public decimal? LatestBurnout { get; set; }
    public bool LatestIsExhausted { get; set; }
    public List<int> PeakHourBuckets { get; set; } = new();
    public decimal StudyHoursToday { get; set; }
    public List<string> Badges { get; set; } = new();
    public Dictionary<string, decimal> WeeklyStudyData { get; set; } = new();
}
