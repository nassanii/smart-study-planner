using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Infrastructure.Persistence.Configurations;

public class FocusSessionConfiguration : IEntityTypeConfiguration<FocusSession>
{
    public void Configure(EntityTypeBuilder<FocusSession> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Mode).HasConversion<short>();
        builder.Property(s => s.SnoozeReason).HasMaxLength(200);

        builder.HasOne<ApplicationUser>()
            .WithMany(u => u.FocusSessions)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Task)
            .WithMany()
            .HasForeignKey(s => s.TaskId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(s => s.Subject)
            .WithMany(sub => sub.FocusSessions)
            .HasForeignKey(s => s.SubjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.UserId, s.StartedAt });
        builder.HasIndex(s => new { s.UserId, s.SubjectId, s.StartedAt });

        builder.ToTable(t => t.HasCheckConstraint("ck_focus_sessions_rating", "focus_rating IS NULL OR (focus_rating >= 1 AND focus_rating <= 5)"));
    }
}
