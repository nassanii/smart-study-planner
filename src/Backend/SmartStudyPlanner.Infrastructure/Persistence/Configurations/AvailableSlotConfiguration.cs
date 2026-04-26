using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Infrastructure.Persistence.Configurations;

public class AvailableSlotConfiguration : IEntityTypeConfiguration<AvailableSlot>
{
    public void Configure(EntityTypeBuilder<AvailableSlot> builder)
    {
        builder.HasKey(s => s.Id);

        builder.HasOne<ApplicationUser>()
            .WithMany(u => u.AvailableSlots)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.UserId, s.DayOfWeek });
        builder.HasIndex(s => new { s.UserId, s.Date });

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("ck_available_slots_xor", "(day_of_week IS NULL) <> (date IS NULL)");
            t.HasCheckConstraint("ck_available_slots_time_order", "end_time > start_time");
        });
    }
}
