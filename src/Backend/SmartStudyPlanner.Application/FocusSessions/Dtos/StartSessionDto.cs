using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Application.FocusSessions.Dtos;

public class StartSessionDto
{
    public int? TaskId { get; set; }
    public int SubjectId { get; set; }
    public FocusMode Mode { get; set; }
}
