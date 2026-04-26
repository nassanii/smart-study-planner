using SmartStudyPlanner.Application.Subjects.Dtos;
using SmartStudyPlanner.Application.AvailableSlots.Dtos;

namespace SmartStudyPlanner.Application.Users.Dtos;

public class OnboardingDto
{
    public string Name { get; set; } = string.Empty;
    public DateOnly Deadline { get; set; }
    public List<NewSubjectDto> Subjects { get; set; } = new();
    public List<NewSlotDto> AvailableSlots { get; set; } = new();
}
