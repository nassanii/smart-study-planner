using SmartStudyPlanner.Application.Schedule.Dtos;

namespace SmartStudyPlanner.Application.Schedule.Services;

public interface IScheduleService
{
    Task<GenerateScheduleResponse> GenerateAsync(int userId, DateOnly? date, CancellationToken ct);
    Task<GenerateScheduleResponse?> GetTodayAsync(int userId, CancellationToken ct);
    Task<GenerateScheduleResponse?> GetByDateAsync(int userId, DateOnly date, CancellationToken ct);
    Task<IReadOnlyList<ScheduleSummaryDto>> GetHistoryAsync(int userId, int limit, CancellationToken ct);
    Task UpdateSlotStatusAsync(int userId, int scheduleId, int slotIndex, SlotStatusDto status, CancellationToken ct);
}
