namespace SmartStudyPlanner.Application.Schedule.Dtos;

public class GenerateScheduleRequest
{
    public DateOnly? Date { get; set; }
    public bool UseAi { get; set; }
}
