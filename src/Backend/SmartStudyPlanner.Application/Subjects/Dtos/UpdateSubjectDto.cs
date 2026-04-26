namespace SmartStudyPlanner.Application.Subjects.Dtos;

public class UpdateSubjectDto
{
    public string? Name { get; set; }
    public short? Difficulty { get; set; }
    public DateOnly? ExamDate { get; set; }
}
