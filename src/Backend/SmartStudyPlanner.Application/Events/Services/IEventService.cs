using SmartStudyPlanner.Application.Events.Dtos;

namespace SmartStudyPlanner.Application.Events.Services;

public interface IEventService
{
    Task<List<EventDto>> ListAsync(int userId, CancellationToken ct = default);
    Task<EventDto> GetByIdAsync(int id, int userId, CancellationToken ct = default);
    Task<EventDto> CreateAsync(int userId, CreateEventDto dto, CancellationToken ct = default);
    Task<EventDto> UpdateAsync(int id, int userId, UpdateEventDto dto, CancellationToken ct = default);
    Task DeleteAsync(int id, int userId, CancellationToken ct = default);
}
