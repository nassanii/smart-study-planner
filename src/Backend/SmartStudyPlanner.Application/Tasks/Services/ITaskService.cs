using SmartStudyPlanner.Application.Tasks.Dtos;

namespace SmartStudyPlanner.Application.Tasks.Services;

public enum TaskFilter
{
    All,
    High,
    Today,
    Done
}

public interface ITaskService
{
    Task<IReadOnlyList<TaskDto>> ListAsync(int userId, TaskFilter filter, CancellationToken ct);
    Task<TaskDto> GetAsync(int userId, int id, CancellationToken ct);
    Task<TaskDto> CreateAsync(int userId, NewTaskDto dto, CancellationToken ct);
    Task<TaskDto> UpdateAsync(int userId, int id, UpdateTaskDto dto, CancellationToken ct);
    Task<TaskDto> UpdateDifficultyAsync(int userId, int id, short difficulty, CancellationToken ct);
    Task<TaskDto> CompleteAsync(int userId, int id, int actualMinutes, CancellationToken ct);
    Task<TaskDto> SnoozeAsync(int userId, int id, string? reason, CancellationToken ct);
    Task DeleteAsync(int userId, int id, CancellationToken ct);
}
