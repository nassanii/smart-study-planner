using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartStudyPlanner.Application.Identity;

namespace SmartStudyPlanner.Infrastructure.Persistence.Configurations;

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(u => u.Name).HasMaxLength(200).IsRequired();
        builder.Property(u => u.TargetGpa).HasColumnType("decimal(3,2)");
        builder.Property(u => u.MaxHoursPerDay).HasColumnType("decimal(4,2)");
        builder.Property(u => u.CreatedAt).IsRequired();
        builder.Property(u => u.UpdatedAt).IsRequired();

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_users_target_gpa_range", "target_gpa IS NULL OR (target_gpa >= 0 AND target_gpa <= 4)");
            t.HasCheckConstraint("ck_users_max_hours_range", "max_hours_per_day IS NULL OR (max_hours_per_day > 0 AND max_hours_per_day <= 24)");
        });
    }
}
