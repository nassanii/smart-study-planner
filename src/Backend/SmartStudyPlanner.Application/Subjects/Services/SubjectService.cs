using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Application.Subjects.Dtos;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.Subjects.Services;

public class SubjectService : ISubjectService
{
    private readonly IAppDbContext _db;
    private readonly TimeProvider _time;

    public SubjectService(IAppDbContext db, TimeProvider time)
    {
        _db = db;
        _time = time;
    }

    public async Task<IReadOnlyList<SubjectDto>> ListAsync(int userId, CancellationToken ct)
    {
        return await _db.Subjects
            .Where(s => s.UserId == userId)
            .OrderBy(s => s.Name)
            .Select(s => Map(s))
            .ToListAsync(ct);
    }

    public async Task<SubjectDto> GetAsync(int userId, int id, CancellationToken ct)
    {
        var s = await _db.Subjects.FirstOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
            ?? throw new NotFoundException("Subject", id);
        return Map(s);
    }

    public async Task<SubjectDto> CreateAsync(int userId, NewSubjectDto dto, CancellationToken ct)
    {
        var nameTaken = await _db.Subjects.AnyAsync(s => s.UserId == userId && s.Name == dto.Name, ct);
        if (nameTaken)
        {
            throw new ConflictException("A subject with this name already exists.");
        }

        var entity = new Subject
        {
            UserId = userId,
            Name = dto.Name,
            Difficulty = dto.Difficulty,
            ExamDate = dto.ExamDate,
            CreatedAt = _time.GetUtcNow()
        };
        _db.Subjects.Add(entity);
        await _db.SaveChangesAsync(ct);
        return Map(entity);
    }

    public async Task<SubjectDto> UpdateAsync(int userId, int id, UpdateSubjectDto dto, CancellationToken ct)
    {
        var s = await _db.Subjects.FirstOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
            ?? throw new NotFoundException("Subject", id);

        if (dto.Name is not null && dto.Name != s.Name)
        {
            var taken = await _db.Subjects.AnyAsync(x => x.UserId == userId && x.Id != id && x.Name == dto.Name, ct);
            if (taken) throw new ConflictException("A subject with this name already exists.");
            s.Name = dto.Name;
        }
        if (dto.Difficulty.HasValue) s.Difficulty = dto.Difficulty.Value;
        if (dto.ExamDate.HasValue) s.ExamDate = dto.ExamDate;

        await _db.SaveChangesAsync(ct);
        return Map(s);
    }

    public async Task DeleteAsync(int userId, int id, CancellationToken ct)
    {
        var s = await _db.Subjects.FirstOrDefaultAsync(x => x.UserId == userId && x.Id == id, ct)
            ?? throw new NotFoundException("Subject", id);
        _db.Subjects.Remove(s);
        await _db.SaveChangesAsync(ct);
    }

    internal static SubjectDto Map(Subject s) => new()
    {
        Id = s.Id,
        Name = s.Name,
        Difficulty = s.Difficulty,
        ExamDate = s.ExamDate,
        CreatedAt = s.CreatedAt
    };
}
