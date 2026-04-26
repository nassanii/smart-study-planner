namespace SmartStudyPlanner.Domain.Entities;

public class Subject
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public short Difficulty { get; set; }
    public DateOnly? ExamDate { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public ICollection<StudyTask> Tasks { get; set; } = new List<StudyTask>();
    public ICollection<FocusSession> FocusSessions { get; set; } = new List<FocusSession>();
}
