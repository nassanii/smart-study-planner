using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Domain.Entities;
using SmartStudyPlanner.Domain.Enums;
using SmartStudyPlanner.Infrastructure.Persistence;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Route("api/v1/seed")]
public class SeedController : ControllerBase
{
    private static readonly JsonSerializerOptions AiJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _environment;

    public SeedController(
        UserManager<ApplicationUser> userManager,
        AppDbContext context,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        _userManager = userManager;
        _context = context;
        _configuration = configuration;
        _environment = environment;
    }

    [AllowAnonymous]
    [HttpPost]
    public async Task<IActionResult> SeedDatabase(CancellationToken ct)
    {
        if (!SeedTokenIsValid())
        {
            return Unauthorized(new { message = "Seed endpoint is not available." });
        }

        var email = _configuration["Seed:UserEmail"]
            ?? Environment.GetEnvironmentVariable("SEED_USER_EMAIL")
            ?? "student@smart-study.local";
        var password = _configuration["Seed:UserPassword"]
            ?? Environment.GetEnvironmentVariable("SEED_USER_PASSWORD");
        var displayName = _configuration["Seed:UserName"]
            ?? Environment.GetEnvironmentVariable("SEED_USER_NAME")
            ?? "Student";

        if (string.IsNullOrWhiteSpace(password))
        {
            return BadRequest(new { message = "Seed user password is not configured." });
        }

        var existingUser = await _userManager.FindByEmailAsync(email);
        if (existingUser is not null)
        {
            await _userManager.DeleteAsync(existingUser);
        }

        var now = DateTimeOffset.UtcNow;
        var today = DateOnly.FromDateTime(now.UtcDateTime);
        DateOnly Day(int offset) => today.AddDays(offset);
        DateTimeOffset At(int dayOffset, int hour, int minute = 0)
            => new(Day(dayOffset).ToDateTime(new TimeOnly(hour, minute)), TimeSpan.Zero);

        var user = new ApplicationUser
        {
            Name = displayName,
            Email = email,
            UserName = email,
            EmailConfirmed = true,
            IsOnboarded = true,
            CreatedAt = now.AddDays(-52),
            UpdatedAt = now.AddMinutes(-20),
            Deadline = Day(90)
        };

        var createResult = await _userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            return BadRequest(new { message = "Failed to create student account", errors = createResult.Errors });
        }

        var userId = user.Id;

        var courseSeeds = new List<CourseSeed>
        {
            new("MATH112 Calculus II", 7, 2, 18, 49),
            new("SENG202 Data Structures and Algorithms II", 9, 1, 14, 45),
            new("SENG226 Software Design", 7, 1, 17, 47),
            new("SENG228 Human Computer Interaction", 6, 2, 20, 51),
            new("SENG303 Full-Stack Web Development", 8, 1, 12, 42),
            new("SENG304 Introduction to DBMS", 7, 2, 21, 54),
            new("SENG321 Introduction to Operating Systems", 8, 1, 16, 48),
            new("SENG324 Software Validation and Verification", 7, 2, 22, 55),
            new("SENG390 Senior Project I", 9, 1, 9, 30),
            new("SENG425 Software Project Management and Economics", 6, 2, 24, 58)
        };

        var subjects = courseSeeds.Select((course, index) => new Subject
        {
            UserId = userId,
            Name = course.Name,
            Difficulty = course.Difficulty,
            Priority = course.Priority,
            MidtermDate = Day(course.MidtermDays),
            FinalDate = Day(course.FinalDays),
            ExamDate = Day(course.FinalDays),
            CreatedAt = now.AddDays(-45 + index)
        }).ToList();

        _context.Subjects.AddRange(subjects);
        await _context.SaveChangesAsync(ct);

        var subjectByName = subjects.ToDictionary(s => s.Name, StringComparer.Ordinal);

        var taskSeeds = BuildTaskSeeds();
        var tasks = taskSeeds.Select((seed, index) =>
        {
            var createdAt = At(seed.CreatedDays, 9 + (index % 8), index % 2 == 0 ? 0 : 30);
            var updatedAt = seed.CompletedDays.HasValue
                ? At(seed.CompletedDays.Value, 20, index % 2 == 0 ? 10 : 40)
                : now.AddDays(Math.Min(seed.CreatedDays + 2, 0));

            return new StudyTask
            {
                UserId = userId,
                SubjectId = subjectByName[seed.Course].Id,
                Title = seed.Title,
                Priority = seed.Priority,
                DifficultyRating = seed.Difficulty,
                EstimatedMinutes = seed.EstimatedMinutes,
                ActualMinutes = seed.ActualMinutes,
                DaysSinceLastStudy = seed.Status == StudyTaskStatus.Done ? 0 : Math.Abs(seed.CreatedDays) % 6,
                ConsecutiveDaysStudied = seed.Status == StudyTaskStatus.Done ? 2 + (index % 4) : index % 3,
                Status = seed.Status,
                Deadline = Day(seed.DeadlineDays),
                StartTime = seed.StartHour.HasValue ? new TimeOnly(seed.StartHour.Value, seed.StartMinute) : null,
                TaskType = TaskType.Study,
                IsManual = true,
                Tag = seed.Tag,
                CompletedAt = seed.CompletedDays.HasValue ? At(seed.CompletedDays.Value, 20, index % 2 == 0 ? 10 : 40) : null,
                CreatedAt = createdAt,
                UpdatedAt = updatedAt
            };
        }).ToList();

        _context.StudyTasks.AddRange(tasks);
        await _context.SaveChangesAsync(ct);

        var taskByTitle = tasks.ToDictionary(t => t.Title, StringComparer.Ordinal);

        var dayPlans = BuildDayPlans();
        var focusSessions = new List<FocusSession>();
        var completedTasks = tasks.Where(t => t.Status == StudyTaskStatus.Done).ToList();
        var sessionSubjectOrder = subjects
            .OrderBy(s => s.Priority)
            .ThenByDescending(s => s.Difficulty)
            .ToList();

        for (var i = 0; i < dayPlans.Count; i++)
        {
            var plan = dayPlans[i];
            var dayOffset = plan.DayOffset;
            var ratings = plan.Ratings.ToList();
            var sessionCount = Math.Max(1, ratings.Count);
            var minutesLeft = (int)Math.Round(plan.StudyHours * 60m);

            for (var sessionIndex = 0; sessionIndex < sessionCount; sessionIndex++)
            {
                var subject = sessionSubjectOrder[(i + sessionIndex) % sessionSubjectOrder.Count];
                var task = completedTasks.Count == 0
                    ? null
                    : completedTasks[(i + sessionIndex) % completedTasks.Count];

                if (task is not null && task.SubjectId != subject.Id)
                {
                    subject = subjects.First(s => s.Id == task.SubjectId);
                }

                var sessionsRemaining = sessionCount - sessionIndex;
                var minutes = Math.Max(20, minutesLeft / sessionsRemaining);
                minutesLeft -= minutes;
                var hour = new[] { 9, 11, 14, 19 }[sessionIndex % 4];
                var startedAt = At(dayOffset, hour, sessionIndex % 2 == 0 ? 0 : 30);

                focusSessions.Add(new FocusSession
                {
                    UserId = userId,
                    SubjectId = subject.Id,
                    TaskId = task?.Id,
                    Mode = FocusMode.Focus25,
                    DurationSeconds = minutes * 60,
                    FocusRating = (short)ratings[sessionIndex % ratings.Count],
                    StartedAt = startedAt,
                    CompletedAt = startedAt.AddMinutes(minutes)
                });
            }
        }

        var behavioralLogs = dayPlans.Select(plan => new BehavioralLog
        {
            UserId = userId,
            Date = Day(plan.DayOffset),
            SnoozeCount = plan.Snoozes,
            StudyHours = plan.StudyHours,
            AvgFocusRating = Math.Round((decimal)plan.Ratings.Average(), 2),
            LastFocusRatingsJson = JsonSerializer.Serialize(plan.Ratings)
        }).ToList();

        _context.FocusSessions.AddRange(focusSessions);
        _context.BehavioralLogs.AddRange(behavioralLogs);
        await _context.SaveChangesAsync(ct);

        var slots = new List<AvailableSlot>
        {
            new() { UserId = userId, DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(11, 30) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Monday, StartTime = new TimeOnly(18, 30), EndTime = new TimeOnly(22, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Tuesday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(12, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Tuesday, StartTime = new TimeOnly(19, 0), EndTime = new TimeOnly(22, 30) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Wednesday, StartTime = new TimeOnly(9, 30), EndTime = new TimeOnly(12, 30) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Wednesday, StartTime = new TimeOnly(18, 0), EndTime = new TimeOnly(21, 30) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Thursday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(12, 30) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Thursday, StartTime = new TimeOnly(18, 30), EndTime = new TimeOnly(22, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Friday, StartTime = new TimeOnly(9, 0), EndTime = new TimeOnly(11, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Friday, StartTime = new TimeOnly(16, 30), EndTime = new TimeOnly(20, 30) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Saturday, StartTime = new TimeOnly(10, 0), EndTime = new TimeOnly(15, 0) },
            new() { UserId = userId, DayOfWeek = DayOfWeek.Sunday, StartTime = new TimeOnly(13, 0), EndTime = new TimeOnly(18, 0) }
        };

        _context.AvailableSlots.AddRange(slots);
        await _context.SaveChangesAsync(ct);

        var schedule = BuildTodaySchedule(userId, today, taskByTitle, subjects);
        _context.AiSchedules.Add(schedule);
        await _context.SaveChangesAsync(ct);

        return Ok(new
        {
            message = "Student workspace seeded successfully.",
            email,
            courses = subjects.Count,
            tasks = tasks.Count,
            completedTasks = tasks.Count(t => t.Status == StudyTaskStatus.Done),
            focusSessions = focusSessions.Count,
            dayStreak = dayPlans.Count,
            todayScheduleBlocks = 8
        });
    }

    private bool SeedTokenIsValid()
    {
        var expectedToken = _configuration["Seed:Token"]
            ?? Environment.GetEnvironmentVariable("SEED_TOKEN");

        if (string.IsNullOrWhiteSpace(expectedToken))
        {
            return _environment.IsDevelopment();
        }

        var providedToken = Request.Headers["X-Seed-Token"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(providedToken))
        {
            return false;
        }

        var providedBytes = Encoding.UTF8.GetBytes(providedToken);
        var expectedBytes = Encoding.UTF8.GetBytes(expectedToken);
        return providedBytes.Length == expectedBytes.Length
            && CryptographicOperations.FixedTimeEquals(providedBytes, expectedBytes);
    }

    private static List<TaskSeed> BuildTaskSeeds() => new()
    {
        new("MATH112 Calculus II", "Work through integration by parts exercises", TaskPriority.Medium, 6, 65, StudyTaskStatus.Done, -18, -18, 70, "Practice", null, 0, -31),
        new("MATH112 Calculus II", "Review improper integral convergence tests", TaskPriority.High, 7, 55, StudyTaskStatus.Done, -12, -12, 58, "Revision", null, 0, -25),
        new("MATH112 Calculus II", "Practice Taylor and Maclaurin series", TaskPriority.High, 8, 75, StudyTaskStatus.InProgress, 0, null, 35, "Exam prep", 11, 0, -6),
        new("MATH112 Calculus II", "Finish power series comparison questions", TaskPriority.Medium, 7, 60, StudyTaskStatus.Upcoming, 4, null, null, "Homework", 17, 30, -4),
        new("MATH112 Calculus II", "Summarize volume by shells method", TaskPriority.Low, 5, 45, StudyTaskStatus.Done, -6, -6, 48, "Notes", null, 0, -14),

        new("SENG202 Data Structures and Algorithms II", "Analyze recursive algorithm complexity", TaskPriority.High, 8, 75, StudyTaskStatus.Done, -20, -20, 82, "Algorithms", null, 0, -34),
        new("SENG202 Data Structures and Algorithms II", "Practice heap and hashing problems", TaskPriority.High, 8, 90, StudyTaskStatus.Done, -14, -14, 96, "Practice", null, 0, -29),
        new("SENG202 Data Structures and Algorithms II", "Solve graph traversal worksheet", TaskPriority.High, 9, 80, StudyTaskStatus.InProgress, 0, null, 45, "Graph algorithms", 9, 0, -5),
        new("SENG202 Data Structures and Algorithms II", "Compare greedy and dynamic programming cases", TaskPriority.Medium, 8, 70, StudyTaskStatus.Upcoming, 3, null, null, "Exam prep", 18, 0, -3),
        new("SENG202 Data Structures and Algorithms II", "Prepare backtracking quiz notes", TaskPriority.Medium, 7, 60, StudyTaskStatus.Upcoming, 8, null, null, "Quiz", null, 0, -2),

        new("SENG226 Software Design", "Draw class diagram for planner modules", TaskPriority.High, 7, 85, StudyTaskStatus.Done, -16, -16, 90, "UML", null, 0, -30),
        new("SENG226 Software Design", "Review design pattern examples", TaskPriority.Medium, 6, 60, StudyTaskStatus.Done, -9, -9, 56, "Revision", null, 0, -20),
        new("SENG226 Software Design", "Refine sequence diagram for notifications", TaskPriority.High, 8, 70, StudyTaskStatus.InProgress, 1, null, 40, "Project", 15, 0, -4),
        new("SENG226 Software Design", "Write notes on cohesion and coupling", TaskPriority.Medium, 6, 50, StudyTaskStatus.Upcoming, 5, null, null, "Notes", null, 0, -3),
        new("SENG226 Software Design", "Prepare case study questions", TaskPriority.Low, 5, 45, StudyTaskStatus.Snoozed, 7, null, 15, "Case study", null, 0, -7),

        new("SENG228 Human Computer Interaction", "Review usability evaluation methods", TaskPriority.Medium, 6, 55, StudyTaskStatus.Done, -15, -15, 50, "Revision", null, 0, -27),
        new("SENG228 Human Computer Interaction", "Create user persona notes", TaskPriority.Medium, 5, 45, StudyTaskStatus.Done, -10, -10, 47, "Design", null, 0, -22),
        new("SENG228 Human Computer Interaction", "Refine mobile dashboard interactions", TaskPriority.High, 7, 70, StudyTaskStatus.InProgress, 0, null, 30, "Prototype", 14, 0, -5),
        new("SENG228 Human Computer Interaction", "Prepare heuristic inspection checklist", TaskPriority.Medium, 6, 60, StudyTaskStatus.Upcoming, 6, null, null, "Checklist", null, 0, -3),
        new("SENG228 Human Computer Interaction", "Collect feedback notes from classmates", TaskPriority.Low, 4, 35, StudyTaskStatus.Upcoming, 10, null, null, "Feedback", null, 0, -1),

        new("SENG303 Full-Stack Web Development", "Review API authentication flow", TaskPriority.High, 8, 80, StudyTaskStatus.Done, -17, -17, 88, "Backend", null, 0, -32),
        new("SENG303 Full-Stack Web Development", "Connect task filters to live API", TaskPriority.High, 7, 75, StudyTaskStatus.Done, -8, -8, 83, "Frontend", null, 0, -18),
        new("SENG303 Full-Stack Web Development", "Test schedule generation screen", TaskPriority.High, 8, 70, StudyTaskStatus.InProgress, 1, null, 25, "Testing", 16, 30, -4),
        new("SENG303 Full-Stack Web Development", "Polish loading and empty states", TaskPriority.Medium, 6, 55, StudyTaskStatus.Upcoming, 4, null, null, "Frontend", null, 0, -2),
        new("SENG303 Full-Stack Web Development", "Prepare deployment checklist", TaskPriority.Medium, 6, 60, StudyTaskStatus.Snoozed, 9, null, 20, "Deployment", null, 0, -6),

        new("SENG304 Introduction to DBMS", "Practice relational algebra queries", TaskPriority.Medium, 7, 70, StudyTaskStatus.Done, -19, -19, 74, "Queries", null, 0, -35),
        new("SENG304 Introduction to DBMS", "Review normalization examples", TaskPriority.High, 8, 65, StudyTaskStatus.Done, -11, -11, 68, "Revision", null, 0, -24),
        new("SENG304 Introduction to DBMS", "Design ER model for study planner", TaskPriority.High, 7, 80, StudyTaskStatus.InProgress, 2, null, 50, "Modeling", 19, 0, -5),
        new("SENG304 Introduction to DBMS", "Summarize transaction isolation levels", TaskPriority.Medium, 6, 50, StudyTaskStatus.Upcoming, 7, null, null, "Notes", null, 0, -2),
        new("SENG304 Introduction to DBMS", "Solve SQL joins practice set", TaskPriority.Medium, 6, 55, StudyTaskStatus.Upcoming, 11, null, null, "Practice", null, 0, -1),

        new("SENG321 Introduction to Operating Systems", "Review process scheduling algorithms", TaskPriority.High, 8, 75, StudyTaskStatus.Done, -13, -13, 78, "Revision", null, 0, -26),
        new("SENG321 Introduction to Operating Systems", "Practice deadlock detection problems", TaskPriority.High, 8, 70, StudyTaskStatus.Done, -7, -7, 76, "Practice", null, 0, -17),
        new("SENG321 Introduction to Operating Systems", "Summarize virtual memory concepts", TaskPriority.High, 8, 65, StudyTaskStatus.InProgress, 3, null, 30, "Memory", null, 0, -4),
        new("SENG321 Introduction to Operating Systems", "Compare semaphores and monitors", TaskPriority.Medium, 7, 55, StudyTaskStatus.Upcoming, 6, null, null, "Concurrency", null, 0, -3),
        new("SENG321 Introduction to Operating Systems", "Finish file system notes", TaskPriority.Medium, 6, 45, StudyTaskStatus.Upcoming, 12, null, null, "Notes", null, 0, -1),

        new("SENG324 Software Validation and Verification", "Review black-box testing techniques", TaskPriority.Medium, 6, 55, StudyTaskStatus.Done, -12, -12, 52, "Testing", null, 0, -23),
        new("SENG324 Software Validation and Verification", "Write unit test plan for task service", TaskPriority.High, 8, 85, StudyTaskStatus.Done, -5, -5, 92, "Project", null, 0, -15),
        new("SENG324 Software Validation and Verification", "Prepare risk-based testing notes", TaskPriority.Medium, 7, 60, StudyTaskStatus.Upcoming, 5, null, null, "Notes", null, 0, -3),
        new("SENG324 Software Validation and Verification", "Check regression scenarios for login", TaskPriority.High, 8, 70, StudyTaskStatus.InProgress, 2, null, 25, "Testing", null, 0, -4),
        new("SENG324 Software Validation and Verification", "Review static analysis checklist", TaskPriority.Low, 5, 40, StudyTaskStatus.Snoozed, 10, null, 10, "Checklist", null, 0, -5),

        new("SENG390 Senior Project I", "Finalize problem statement", TaskPriority.High, 8, 60, StudyTaskStatus.Done, -21, -21, 58, "Graduation project", null, 0, -40),
        new("SENG390 Senior Project I", "Update advisor meeting notes", TaskPriority.Medium, 6, 45, StudyTaskStatus.Done, -4, -4, 42, "Meeting", null, 0, -12),
        new("SENG390 Senior Project I", "Write senior project defense script", TaskPriority.High, 9, 90, StudyTaskStatus.InProgress, 0, null, 55, "Presentation", 20, 0, -3),
        new("SENG390 Senior Project I", "Prepare slides for system architecture", TaskPriority.High, 8, 80, StudyTaskStatus.Upcoming, 1, null, null, "Presentation", 21, 0, -2),
        new("SENG390 Senior Project I", "Run full rehearsal on personal phone", TaskPriority.High, 8, 75, StudyTaskStatus.Upcoming, 1, null, null, "Presentation", null, 0, -1),

        new("SENG425 Software Project Management and Economics", "Review activity planning examples", TaskPriority.Medium, 6, 50, StudyTaskStatus.Done, -10, -10, 49, "Planning", null, 0, -21),
        new("SENG425 Software Project Management and Economics", "Practice effort estimation questions", TaskPriority.Medium, 6, 60, StudyTaskStatus.Done, -3, -3, 66, "Estimation", null, 0, -9),
        new("SENG425 Software Project Management and Economics", "Prepare risk register for project", TaskPriority.Medium, 7, 65, StudyTaskStatus.InProgress, 4, null, 20, "Project", null, 0, -4),
        new("SENG425 Software Project Management and Economics", "Summarize resource allocation notes", TaskPriority.Low, 5, 45, StudyTaskStatus.Upcoming, 8, null, null, "Notes", null, 0, -2),
        new("SENG425 Software Project Management and Economics", "Review project tracking metrics", TaskPriority.Medium, 6, 50, StudyTaskStatus.Snoozed, 13, null, 15, "Metrics", null, 0, -5)
    };

    private static List<DayPlanSeed> BuildDayPlans() => new()
    {
        new(-20, 1.30m, 0, new[] { 4, 4 }),
        new(-19, 2.10m, 1, new[] { 4, 5, 4 }),
        new(-18, 1.80m, 0, new[] { 4, 4 }),
        new(-17, 2.60m, 0, new[] { 5, 4, 4 }),
        new(-16, 2.20m, 1, new[] { 4, 4, 5 }),
        new(-15, 3.10m, 0, new[] { 5, 5, 4 }),
        new(-14, 2.40m, 0, new[] { 4, 4, 4 }),
        new(-13, 2.80m, 1, new[] { 4, 5, 5 }),
        new(-12, 2.25m, 0, new[] { 4, 4, 5 }),
        new(-11, 3.35m, 0, new[] { 5, 4, 5, 4 }),
        new(-10, 1.90m, 1, new[] { 3, 4 }),
        new(-9, 2.70m, 0, new[] { 4, 5, 4 }),
        new(-8, 2.45m, 0, new[] { 4, 4, 4 }),
        new(-7, 3.20m, 1, new[] { 5, 4, 5 }),
        new(-6, 2.60m, 0, new[] { 4, 5, 4 }),
        new(-5, 3.50m, 0, new[] { 5, 5, 4, 4 }),
        new(-4, 2.95m, 1, new[] { 4, 4, 5 }),
        new(-3, 3.10m, 0, new[] { 5, 4, 5 }),
        new(-2, 2.35m, 0, new[] { 4, 4, 4 }),
        new(-1, 3.75m, 1, new[] { 5, 5, 4, 5 }),
        new(0, 2.75m, 0, new[] { 5, 4, 5 })
    };

    private static AiSchedule BuildTodaySchedule(
        int userId,
        DateOnly today,
        IReadOnlyDictionary<string, StudyTask> taskByTitle,
        IReadOnlyList<Subject> subjects)
    {
        DateTimeOffset At(int hour, int minute = 0)
            => new(today.ToDateTime(new TimeOnly(hour, minute)), TimeSpan.Zero);

        int? TaskId(string title) => taskByTitle.TryGetValue(title, out var task) ? task.Id : null;

        var scheduledSlots = new[]
        {
            new { TimeSlot = "09:00-09:45", Subject = "SENG202 Data Structures and Algorithms II", AdjustedDurationMinutes = 45, ActivityType = "study", TaskId = TaskId("Solve graph traversal worksheet") },
            new { TimeSlot = "10:00-10:40", Subject = "MATH112 Calculus II", AdjustedDurationMinutes = 40, ActivityType = "review", TaskId = TaskId("Practice Taylor and Maclaurin series") },
            new { TimeSlot = "10:40-10:55", Subject = "Short break", AdjustedDurationMinutes = 15, ActivityType = "break", TaskId = (int?)null },
            new { TimeSlot = "14:00-14:45", Subject = "SENG228 Human Computer Interaction", AdjustedDurationMinutes = 45, ActivityType = "study", TaskId = TaskId("Refine mobile dashboard interactions") },
            new { TimeSlot = "16:30-17:10", Subject = "SENG303 Full-Stack Web Development", AdjustedDurationMinutes = 40, ActivityType = "study", TaskId = TaskId("Test schedule generation screen") },
            new { TimeSlot = "19:00-19:45", Subject = "SENG324 Software Validation and Verification", AdjustedDurationMinutes = 45, ActivityType = "study", TaskId = TaskId("Check regression scenarios for login") },
            new { TimeSlot = "20:00-20:50", Subject = "SENG390 Senior Project I", AdjustedDurationMinutes = 50, ActivityType = "review", TaskId = TaskId("Write senior project defense script") },
            new { TimeSlot = "21:00-21:30", Subject = "SENG390 Senior Project I", AdjustedDurationMinutes = 30, ActivityType = "study", TaskId = TaskId("Prepare slides for system architecture") }
        };

        var responsePayload = new
        {
            Status = "success",
            AnalysisResults = new
            {
                User = userId,
                Mode = "Machine Learning",
                BurnoutScore = 0.260,
                IsExhausted = false,
                DifficultyFactors = new Dictionary<string, double>
                {
                    ["task_load"] = 0.42,
                    ["deadline_pressure"] = 0.58,
                    ["recent_focus"] = 0.18,
                    ["snooze_pattern"] = 0.12
                }
            },
            AiSchedule = new
            {
                ScheduledSlots = scheduledSlots,
                PostponedTasks = new[]
                {
                    TaskId("Prepare deployment checklist"),
                    TaskId("Review project tracking metrics")
                }.Where(id => id.HasValue).Select(id => id!.Value).ToList(),
                AiMessage = "Start with algorithms while focus is highest, then keep the project rehearsal short and concrete."
            }
        };

        var requestPayload = new
        {
            UserId = userId,
            Deadline = today.AddDays(90).ToString("yyyy-MM-dd"),
            Subjects = subjects.Select(s => new
            {
                s.Id,
                s.Name,
                s.Difficulty,
                s.Priority,
                ExamDate = s.ExamDate
            }),
            AvailableSlots = new[]
            {
                new { StartTime = "09:00", EndTime = "11:30" },
                new { StartTime = "14:00", EndTime = "17:30" },
                new { StartTime = "19:00", EndTime = "21:30" }
            }
        };

        var slotStatuses = new Dictionary<int, SlotSeedStatus>
        {
            [0] = new("completed", null),
            [1] = new("in_progress", null),
            [2] = new("pending", null),
            [3] = new("pending", null),
            [4] = new("pending", null),
            [5] = new("pending", null),
            [6] = new("pending", null),
            [7] = new("pending", null)
        };

        return new AiSchedule
        {
            UserId = userId,
            GeneratedAt = At(8, 5),
            Mode = ScheduleMode.Ml,
            BurnoutScore = 0.260m,
            IsExhausted = false,
            AiMessage = "Start with algorithms while focus is highest, then keep the project rehearsal short and concrete.",
            RequestPayload = JsonSerializer.Serialize(requestPayload, AiJsonOptions),
            ResponsePayload = JsonSerializer.Serialize(responsePayload, AiJsonOptions),
            SlotStatusesJson = JsonSerializer.Serialize(slotStatuses, AiJsonOptions),
            HasError = false
        };
    }

    private sealed record CourseSeed(
        string Name,
        short Difficulty,
        short Priority,
        int MidtermDays,
        int FinalDays);

    private sealed record TaskSeed(
        string Course,
        string Title,
        TaskPriority Priority,
        short Difficulty,
        int EstimatedMinutes,
        StudyTaskStatus Status,
        int DeadlineDays,
        int? CompletedDays,
        int? ActualMinutes,
        string Tag,
        int? StartHour,
        int StartMinute,
        int CreatedDays);

    private sealed record DayPlanSeed(
        int DayOffset,
        decimal StudyHours,
        int Snoozes,
        int[] Ratings);

    private sealed record SlotSeedStatus(
        string Status,
        string? Reason);
}
