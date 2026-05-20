using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Application.Subjects.Dtos;
using SmartStudyPlanner.Domain.Entities;

namespace SmartStudyPlanner.Application.Subjects.Services;

public class SubjectService : ISubjectService
{
    private static readonly string[] SubjectAddedTitles =
    {
        "New Subject on Your Shelf",
        "Knowledge Library Expanded",
        "A Fresh Subject Joins the Crew",
        "Subject Locked & Loaded"
    };

    private static readonly string[] SubjectAddedBodies =
    {
        "'{0}' has been added to your subjects. Ready to master it!",
        "Welcome '{0}' to your study lineup. Let the journey begin!",
        "'{0}' is now part of your plan. Time to dive in!",
        "Subject '{0}' added — your next adventure starts here."
    };

    private readonly IAppDbContext _db;
    private readonly TimeProvider _time;
    private readonly IServiceProvider _serviceProvider;

    public SubjectService(IAppDbContext db, TimeProvider time, IServiceProvider serviceProvider)
    {
        _db = db;
        _time = time;
        _serviceProvider = serviceProvider;
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
            Priority = dto.Priority,
            ExamDate = dto.ExamDate,
            CreatedAt = _time.GetUtcNow()
        };
        _db.Subjects.Add(entity);
        await _db.SaveChangesAsync(ct);

        _ = SendSubjectAddedNotificationAsync(userId, entity.Name);

        return Map(entity);
    }

    private async Task SendSubjectAddedNotificationAsync(int userId, string subjectName)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

            var user = await userManager.FindByIdAsync(userId.ToString());
            if (user is null || string.IsNullOrWhiteSpace(user.PushToken)) return;

            var random = Random.Shared;
            var title = SubjectAddedTitles[random.Next(SubjectAddedTitles.Length)];
            var body = string.Format(SubjectAddedBodies[random.Next(SubjectAddedBodies.Length)], subjectName);

            await notificationService.SendNotificationAsync(user.PushToken, title, body, CancellationToken.None);
        }
        catch
        {
        }
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
        if (dto.Priority.HasValue) s.Priority = dto.Priority.Value;
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
        Priority = s.Priority,
        ExamDate = s.ExamDate,
        CreatedAt = s.CreatedAt
    };
}
