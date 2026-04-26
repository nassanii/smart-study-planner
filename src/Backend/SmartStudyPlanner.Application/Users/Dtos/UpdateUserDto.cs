namespace SmartStudyPlanner.Application.Users.Dtos;

public class UpdateUserDto
{
    public string? Name { get; set; }
    public decimal? TargetGpa { get; set; }
    public decimal? MaxHoursPerDay { get; set; }
    public DateOnly? Deadline { get; set; }
}
