using SmartStudyPlanner.Application.Subjects.Dtos;

namespace SmartStudyPlanner.Application.Subjects.Services;

public interface ISubjectService
{
    Task<IReadOnlyList<SubjectDto>> ListAsync(int userId, CancellationToken ct);
    Task<SubjectDto> GetAsync(int userId, int id, CancellationToken ct);
    Task<SubjectDto> CreateAsync(int userId, NewSubjectDto dto, CancellationToken ct);
    Task<SubjectDto> UpdateAsync(int userId, int id, UpdateSubjectDto dto, CancellationToken ct);
    Task DeleteAsync(int userId, int id, CancellationToken ct);
}
