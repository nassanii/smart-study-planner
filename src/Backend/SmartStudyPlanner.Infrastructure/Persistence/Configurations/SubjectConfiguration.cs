using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Infrastructure.Persistence.Configurations;

public class SubjectConfiguration : IEntityTypeConfiguration<Subject>
{
    public void Configure(EntityTypeBuilder<Subject> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Name).HasMaxLength(120).IsRequired();
        builder.Property(s => s.Difficulty).IsRequired();
        builder.Property(s => s.CreatedAt).IsRequired();

        builder.HasOne<ApplicationUser>()
            .WithMany(u => u.Subjects)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.UserId, s.Name }).IsUnique();
        builder.HasIndex(s => s.UserId);

        builder.ToTable(t => t.HasCheckConstraint("ck_subjects_difficulty", "difficulty >= 1 AND difficulty <= 10"));
    }
}
