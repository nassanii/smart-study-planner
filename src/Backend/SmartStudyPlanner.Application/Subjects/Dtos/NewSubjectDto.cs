namespace SmartStudyPlanner.Application.Subjects.Dtos;

public class NewSubjectDto
{
    public string Name { get; set; } = string.Empty;
    public short Difficulty { get; set; }
    public DateOnly? ExamDate { get; set; }
}
