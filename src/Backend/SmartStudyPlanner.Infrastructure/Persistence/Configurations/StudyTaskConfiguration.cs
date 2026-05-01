using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;
using SmartStudyPlanner.Domain.Enums;

namespace SmartStudyPlanner.Infrastructure.Persistence.Configurations;

public class StudyTaskConfiguration : IEntityTypeConfiguration<StudyTask>
{
    public void Configure(EntityTypeBuilder<StudyTask> builder)
    {
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Tag).HasMaxLength(60);
        builder.Property(t => t.Priority).HasConversion<short>();
        builder.Property(t => t.Status).HasConversion<short>();

        builder.HasOne<ApplicationUser>()
            .WithMany(u => u.Tasks)
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Subject)
            .WithMany(s => s.Tasks)
            .HasForeignKey(t => t.SubjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => new { t.UserId, t.Status, t.Deadline });
        builder.HasIndex(t => new { t.UserId, t.SubjectId });
        builder.HasIndex(t => new { t.UserId, t.CompletedAt });

        builder.ToTable(t => t.HasCheckConstraint("ck_study_tasks_difficulty", "difficulty_rating >= 1 AND difficulty_rating <= 10"));
    }
}
