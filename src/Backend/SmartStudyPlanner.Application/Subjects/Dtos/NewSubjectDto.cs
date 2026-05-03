namespace SmartStudyPlanner.Application.Subjects.Dtos;

public class NewSubjectDto
{
    public string Name { get; set; } = string.Empty;
    public string InitialTaskTitle { get; set; } = "Initial Study Session";
    public short Difficulty { get; set; }
    public DateOnly? ExamDate { get; set; }
    public short Priority { get; set; } = 2; // Default to Medium
    public int EstimatedMinutes { get; set; } = 50;
}
