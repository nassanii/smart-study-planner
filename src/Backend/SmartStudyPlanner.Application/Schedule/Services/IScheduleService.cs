using SmartStudyPlanner.Application.Schedule.Dtos;

namespace SmartStudyPlanner.Application.Schedule.Services;

public interface IScheduleService
{
    Task<GenerateScheduleResponse> GenerateAsync(int userId, DateOnly? date, CancellationToken ct);
    Task<GenerateScheduleResponse?> GetTodayAsync(int userId, CancellationToken ct);
    Task<IReadOnlyList<ScheduleSummaryDto>> GetHistoryAsync(int userId, int limit, CancellationToken ct);
}
