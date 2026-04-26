namespace SmartStudyPlanner.Application.AvailableSlots.Dtos;

public class AvailableSlotDto
{
    public int Id { get; set; }
    public DayOfWeek? DayOfWeek { get; set; }
    public DateOnly? Date { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}
