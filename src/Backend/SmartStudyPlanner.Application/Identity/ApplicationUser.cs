using Microsoft.AspNetCore.Identity;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.Identity;

public class ApplicationUser : IdentityUser<int>
{
    public string Name { get; set; } = string.Empty;
    public decimal? TargetGpa { get; set; }
    public decimal? MaxHoursPerDay { get; set; }
    public DateOnly? Deadline { get; set; }
    public bool IsOnboarded { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Subject> Subjects { get; set; } = new List<Subject>();
    public ICollection<StudyTask> Tasks { get; set; } = new List<StudyTask>();
    public ICollection<FocusSession> FocusSessions { get; set; } = new List<FocusSession>();
    public ICollection<BehavioralLog> BehavioralLogs { get; set; } = new List<BehavioralLog>();
    public ICollection<AvailableSlot> AvailableSlots { get; set; } = new List<AvailableSlot>();
    public ICollection<AiSchedule> AiSchedules { get; set; } = new List<AiSchedule>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
