using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Infrastructure.Persistence.Configurations;

public class BehavioralLogConfiguration : IEntityTypeConfiguration<BehavioralLog>
{
    public void Configure(EntityTypeBuilder<BehavioralLog> builder)
    {
        builder.HasKey(b => b.Id);
        builder.Property(b => b.StudyHours).HasColumnType("decimal(5,2)");
        builder.Property(b => b.AvgFocusRating).HasColumnType("decimal(3,2)");
        builder.Property(b => b.LastFocusRatingsJson).HasColumnType("jsonb");

        builder.HasOne<ApplicationUser>()
            .WithMany(u => u.BehavioralLogs)
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(b => new { b.UserId, b.Date }).IsUnique();
    }
}
