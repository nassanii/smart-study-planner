namespace SmartStudyPlanner.Application.Auth.Dtos;

public class UserMeDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public decimal? TargetGpa { get; set; }
    public decimal? MaxHoursPerDay { get; set; }
    public DateOnly? Deadline { get; set; }
    public bool IsOnboarded { get; set; }
}
