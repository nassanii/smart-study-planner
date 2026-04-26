using SmartStudyPlanner.Application.FocusSessions.Dtos;

namespace SmartStudyPlanner.Application.FocusSessions.Services;

public interface IFocusSessionService
{
    Task<IReadOnlyList<FocusSessionDto>> ListAsync(int userId, DateOnly? from, DateOnly? to, CancellationToken ct);
    Task<FocusSessionDto> StartAsync(int userId, StartSessionDto dto, CancellationToken ct);
    Task<FocusSessionDto> CompleteAsync(int userId, int id, CompleteSessionDto dto, CancellationToken ct);
}
