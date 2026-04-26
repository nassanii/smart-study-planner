namespace SmartStudyPlanner.Application.AvailableSlots.Dtos;

public class NewSlotDto
{
    public DayOfWeek? DayOfWeek { get; set; }
    public DateOnly? Date { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
}
