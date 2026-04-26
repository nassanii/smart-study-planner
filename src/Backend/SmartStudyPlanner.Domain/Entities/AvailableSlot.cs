namespace SmartStudyPlanner.Domain.Entities;

public class AvailableSlot
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public DateOnly? Date { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}
