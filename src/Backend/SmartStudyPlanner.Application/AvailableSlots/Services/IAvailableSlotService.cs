using SmartStudyPlanner.Application.AvailableSlots.Dtos;

namespace SmartStudyPlanner.Application.AvailableSlots.Services;

public interface IAvailableSlotService
{
    Task<IReadOnlyList<AvailableSlotDto>> ListForDateAsync(int userId, DateOnly? date, CancellationToken ct);
    Task<AvailableSlotDto> CreateAsync(int userId, NewSlotDto dto, CancellationToken ct);
    Task<AvailableSlotDto> UpdateAsync(int userId, int id, UpdateSlotDto dto, CancellationToken ct);
    Task DeleteAsync(int userId, int id, CancellationToken ct);
}
