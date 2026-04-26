using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.Persistence;

public interface IAppDbContext
{
    DbSet<ApplicationUser> Users { get; }
    DbSet<Subject> Subjects { get; }
    DbSet<StudyTask> StudyTasks { get; }
    DbSet<FocusSession> FocusSessions { get; }
    DbSet<BehavioralLog> BehavioralLogs { get; }
    DbSet<AvailableSlot> AvailableSlots { get; }
    DbSet<AiSchedule> AiSchedules { get; }
    DbSet<RefreshToken> RefreshTokens { get; }

    EntityEntry<TEntity> Entry<TEntity>(TEntity entity) where TEntity : class;

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
