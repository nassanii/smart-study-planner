using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Infrastructure.Persistence;

public class AppDbContext : IdentityDbContext<ApplicationUser, ApplicationRole, int>, IAppDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    DbSet<ApplicationUser> IAppDbContext.Users => Users;
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<StudyTask> StudyTasks => Set<StudyTask>();
    public DbSet<FocusSession> FocusSessions => Set<FocusSession>();
    public DbSet<BehavioralLog> BehavioralLogs => Set<BehavioralLog>();
    public DbSet<AvailableSlot> AvailableSlots => Set<AvailableSlot>();
    public DbSet<AiSchedule> AiSchedules => Set<AiSchedule>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        if (Database.IsSqlite())
        {
            foreach (var entityType in builder.Model.GetEntityTypes())
            {
                var properties = entityType.GetProperties()
                    .Where(p => p.ClrType == typeof(DateTimeOffset) || p.ClrType == typeof(DateTimeOffset?));
                foreach (var property in properties)
                {
                    property.SetValueConverter(new Microsoft.EntityFrameworkCore.Storage.ValueConversion.DateTimeOffsetToStringConverter());
                }
            }
        }
    }
}
