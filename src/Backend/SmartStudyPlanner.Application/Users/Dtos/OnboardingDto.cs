using SmartStudyPlanner.Application.Subjects.Dtos;

namespace SmartStudyPlanner.Application.Users.Dtos;

public class OnboardingDto
{
    public string Name { get; set; } = string.Empty;
    public decimal TargetGpa { get; set; }
    public decimal MaxHoursPerDay { get; set; }
    public DateOnly Deadline { get; set; }
    public List<NewSubjectDto> Subjects { get; set; } = new();
}
