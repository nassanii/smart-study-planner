using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;
using SmartStudyPlanner.Domain.Enums;
using SmartStudyPlanner.Infrastructure.Persistence;
using System.Text.Json;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Route("api/v1/seed")]
public class SeedController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _context;

    public SeedController(UserManager<ApplicationUser> userManager, AppDbContext context)
    {
        _userManager = userManager;
        _context = context;
    }

    [AllowAnonymous]
    [HttpPost]
    public async Task<IActionResult> SeedDatabase(CancellationToken ct)
    {
        var email = "test@test.com";
        var password = "Test1234!";

        // 1. Delete existing user if exists (cascade delete will clean other tables)
        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser != null)
        {
            await _userManager.DeleteAsync(existingUser);
        }

        // 2. Create default user
        var user = new ApplicationUser
        {
            Name = "Test Student",
            Email = email,
            UserName = email,
            EmailConfirmed = true,
            IsOnboarded = true,
            CreatedAt = DateTimeOffset.UtcNow.AddDays(-14),
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-14),
            Deadline = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(90))
        };

        var createResult = await _userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            return BadRequest(new { message = "Failed to create test user", errors = createResult.Errors });
        }

        var userId = user.Id;

        // 3. Seed Subjects
        var subjects = new List<Subject>
        {
            new() { UserId = userId, Name = "Algorithms & Data Structures", Difficulty = 8, Priority = 1, ExamDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)), CreatedAt = DateTimeOffset.UtcNow.AddDays(-14) },
            new() { UserId = userId, Name = "Web Development", Difficulty = 5, Priority = 2, ExamDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(45)), CreatedAt = DateTimeOffset.UtcNow.AddDays(-14) },
            new() { UserId = userId, Name = "Quantum Physics", Difficulty = 9, Priority = 1, ExamDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(60)), CreatedAt = DateTimeOffset.UtcNow.AddDays(-14) },
            new() { UserId = userId, Name = "Organic Chemistry", Difficulty = 7, Priority = 3, ExamDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(75)), CreatedAt = DateTimeOffset.UtcNow.AddDays(-14) }
        };

        _context.Subjects.AddRange(subjects);
        await _context.SaveChangesAsync(ct);

        var algoSubject = subjects[0];
        var webDevSubject = subjects[1];
        var physicsSubject = subjects[2];
        var chemSubject = subjects[3];

        // 4. Seed Study Tasks
        var tasks = new List<StudyTask>
        {
            new()
            {
                UserId = userId,
                SubjectId = algoSubject.Id,
                Title = "Implement AVL Tree",
                Priority = TaskPriority.High,
                DifficultyRating = 8,
                EstimatedMinutes = 120,
                ActualMinutes = 110,
                Status = StudyTaskStatus.Done,
                Deadline = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)),
                CompletedAt = DateTimeOffset.UtcNow.AddDays(-2),
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-5),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-2)
            },
            new()
            {
                UserId = userId,
                SubjectId = physicsSubject.Id,
                Title = "Study for Midterm Exam",
                Priority = TaskPriority.High,
                DifficultyRating = 9,
                EstimatedMinutes = 180,
                Status = StudyTaskStatus.InProgress,
                Deadline = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)),
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-4),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-4)
            },
            new()
            {
                UserId = userId,
                SubjectId = chemSubject.Id,
                Title = "Read Chapter 4 on Carbon Compounds",
                Priority = TaskPriority.Medium,
                DifficultyRating = 6,
                EstimatedMinutes = 60,
                Status = StudyTaskStatus.Upcoming,
                Deadline = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-3),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-3)
            },
            new()
            {
                UserId = userId,
                SubjectId = webDevSubject.Id,
                Title = "React Navigation Tutorial",
                Priority = TaskPriority.Medium,
                DifficultyRating = 5,
                EstimatedMinutes = 90,
                ActualMinutes = 95,
                Status = StudyTaskStatus.Done,
                Deadline = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)),
                CompletedAt = DateTimeOffset.UtcNow.AddDays(-1),
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-2),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
            },
            new()
            {
                UserId = userId,
                SubjectId = webDevSubject.Id,
                Title = "Build Expo Auth Flow",
                Priority = TaskPriority.High,
                DifficultyRating = 6,
                EstimatedMinutes = 150,
                Status = StudyTaskStatus.InProgress,
                Deadline = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)),
                CreatedAt = DateTimeOffset.UtcNow.AddDays(-1),
                UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
            }
        };

        _context.StudyTasks.AddRange(tasks);
        await _context.SaveChangesAsync(ct);

        var avlTask = tasks[0];
        var reactNavTask = tasks[3];

        // 5. Seed Focus Sessions over last 14 days
        var focusSessions = new List<FocusSession>();
        var behavioralLogs = new List<BehavioralLog>();

        // Generate dynamic focus sessions and behavioral logs for days -14 to -1
        var random = new Random();
        for (int i = 14; i >= 1; i--)
        {
            var date = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-i));
            var baseDateTime = DateTime.UtcNow.AddDays(-i);
            
            // How many sessions today (0 to 3)
            int numSessions = random.Next(1, 4);
            var todaySessions = new List<FocusSession>();

            for (int s = 0; s < numSessions; s++)
            {
                // Select a random subject
                var subj = subjects[random.Next(subjects.Count)];
                int? taskId = null;
                if (subj.Id == algoSubject.Id && s == 0) taskId = avlTask.Id;
                if (subj.Id == webDevSubject.Id && s == 0) taskId = reactNavTask.Id;

                var mode = (FocusMode)random.Next(3);
                int duration = mode == FocusMode.Focus25 ? 1500 : (mode == FocusMode.Short5 ? 300 : 900);
                short rating = (short)random.Next(3, 6); // 3 to 5 stars

                var startedAt = new DateTimeOffset(baseDateTime.Year, baseDateTime.Month, baseDateTime.Day, 10 + s * 3, 0, 0, TimeSpan.Zero);
                var completedAt = startedAt.AddSeconds(duration);

                var session = new FocusSession
                {
                    UserId = userId,
                    SubjectId = subj.Id,
                    TaskId = taskId,
                    Mode = mode,
                    DurationSeconds = duration,
                    FocusRating = rating,
                    StartedAt = startedAt,
                    CompletedAt = completedAt
                };

                todaySessions.Add(session);
                focusSessions.Add(session);
            }

            // Create matching behavioral log for this date
            var studyHours = (decimal)todaySessions.Where(s => s.Mode == FocusMode.Focus25 || s.Mode == FocusMode.Long15).Sum(s => s.DurationSeconds) / 3600m;
            // Add some small base hours if 0
            if (studyHours == 0) studyHours = 0.5m;

            var ratings = todaySessions.Where(s => s.FocusRating.HasValue).Select(s => (int)s.FocusRating!.Value).ToList();
            var avgRating = ratings.Any() ? (decimal)ratings.Average() : 4.0m;

            behavioralLogs.Add(new BehavioralLog
            {
                UserId = userId,
                Date = date,
                SnoozeCount = random.Next(0, 3), // simulate 0 to 2 snoozes
                StudyHours = Math.Round(studyHours, 2),
                AvgFocusRating = Math.Round(avgRating, 2),
                LastFocusRatingsJson = JsonSerializer.Serialize(ratings)
            });
        }

        _context.FocusSessions.AddRange(focusSessions);
        _context.BehavioralLogs.AddRange(behavioralLogs);
        await _context.SaveChangesAsync(ct);

        // 6. Seed Available Slots (Weekly Schedule)
        var slots = new List<AvailableSlot>
        {
            new() { UserId = userId, DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(18, 0), EndTime = new TimeOnly(22, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Tuesday, StartTime = new TimeOnly(18, 0), EndTime = new TimeOnly(22, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Wednesday, StartTime = new TimeOnly(18, 0), EndTime = new TimeOnly(22, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Thursday, StartTime = new TimeOnly(18, 0), EndTime = new TimeOnly(22, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Friday, StartTime = new TimeOnly(18, 0), EndTime = new TimeOnly(22, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Saturday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(16, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Sunday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(16, 0) }
        };

        _context.AvailableSlots.AddRange(slots);
        await _context.SaveChangesAsync(ct);

        return Ok(new { message = $"Database seeded successfully for {email}." });
    }
}
