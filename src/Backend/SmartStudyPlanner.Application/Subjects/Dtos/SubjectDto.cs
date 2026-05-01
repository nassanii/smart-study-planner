namespace SmartStudyPlanner.Application.Subjects.Dtos;

public class SubjectDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public short Difficulty { get; set; }
    public short Priority { get; set; }
    public DateOnly? ExamDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
