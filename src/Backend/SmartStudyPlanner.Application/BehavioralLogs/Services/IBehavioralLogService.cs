using SmartStudyPlanner.Application.BehavioralLogs.Dtos;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.BehavioralLogs.Services;

public interface IBehavioralLogService
{
    Task<BehavioralLog> GetOrCreateForDateAsync(int userId, DateOnly date, CancellationToken ct);
    Task IncrementSnoozeAsync(int userId, CancellationToken ct);
    Task AddStudyMinutesAsync(int userId, int minutes, CancellationToken ct);
    Task RecordFocusRatingAsync(int userId, int rating, CancellationToken ct);
    Task<BehavioralLogDto> GetTodayDtoAsync(int userId, CancellationToken ct);
    Task<IReadOnlyList<BehavioralLogDto>> GetRangeAsync(int userId, DateOnly from, DateOnly to, CancellationToken ct);
}
