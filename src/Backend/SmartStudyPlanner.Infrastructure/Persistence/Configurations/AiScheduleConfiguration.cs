using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Infrastructure.Persistence.Configurations;

public class AiScheduleConfiguration : IEntityTypeConfiguration<AiSchedule>
{
    public void Configure(EntityTypeBuilder<AiSchedule> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Mode).HasConversion<short>();
        builder.Property(a => a.BurnoutScore).HasColumnType("decimal(4,3)");
        builder.Property(a => a.AiMessage).HasColumnType("text");
        builder.Property(a => a.RequestPayload).HasColumnType("jsonb").IsRequired();
        builder.Property(a => a.ResponsePayload).HasColumnType("jsonb").IsRequired();

        builder.HasOne<ApplicationUser>()
            .WithMany(u => u.AiSchedules)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(a => new { a.UserId, a.GeneratedAt });
    }
}
