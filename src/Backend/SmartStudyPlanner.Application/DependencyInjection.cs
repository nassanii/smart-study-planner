using FluentValidation;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Polly;
using Polly.Extensions.Http;
using SmartStudyPlanner.Application.Ai;
using SmartStudyPlanner.Application.Analytics.Services;
using SmartStudyPlanner.Application.Auth.Models;
using SmartStudyPlanner.Application.Auth.Services;
using SmartStudyPlanner.Application.AvailableSlots.Services;
using SmartStudyPlanner.Application.BehavioralLogs.Services;
using SmartStudyPlanner.Application.FocusSessions.Services;
using SmartStudyPlanner.Application.Schedule.Mapping;
using SmartStudyPlanner.Application.Schedule.Services;
using SmartStudyPlanner.Application.Subjects.Services;
using SmartStudyPlanner.Application.Tasks.Services;
using SmartStudyPlanner.Application.Users.Services;
using SmartStudyPlanner.Application.Events.Services;

namespace SmartStudyPlanner.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<JwtSettings>(configuration.GetSection("Jwt"));
        services.Configure<PasswordResetSettings>(configuration.GetSection("PasswordReset"));
        services.Configure<AiClientOptions>(configuration.GetSection("AiService"));

        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IJwtTokenService, JwtTokenService>();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<ISubjectService, SubjectService>();
        services.AddScoped<ITaskService, TaskService>();
        services.AddScoped<IFocusSessionService, FocusSessionService>();
        services.AddScoped<IAvailableSlotService, AvailableSlotService>();
        services.AddScoped<IBehavioralLogService, BehavioralLogService>();
        services.AddScoped<IScheduleService, ScheduleService>();
        services.AddScoped<IAnalyticsService, AnalyticsService>();
        services.AddScoped<IEventService, EventService>();
        services.AddScoped<SchedulePayloadBuilder>();

        services.AddHttpClient<AiClient>((sp, client) =>
        {
            var opts = configuration.GetSection("AiService").Get<AiClientOptions>() ?? new AiClientOptions();
            var baseUrl = opts.BaseUrl.EndsWith('/') ? opts.BaseUrl : opts.BaseUrl + "/";
            client.BaseAddress = new Uri(baseUrl);
            client.Timeout = TimeSpan.FromSeconds(opts.TimeoutSeconds);
        }).AddPolicyHandler(request =>
            IsAiScheduleGeneration(request)
                ? Policy.NoOpAsync<HttpResponseMessage>()
                : BuildRetryPolicy());

        services.AddTransient<IAiClient>(sp => sp.GetRequiredService<AiClient>());

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        return services;
    }

    private static IAsyncPolicy<HttpResponseMessage> BuildRetryPolicy() =>
        HttpPolicyExtensions
            .HandleTransientHttpError()
            .WaitAndRetryAsync(3, attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)) + TimeSpan.FromMilliseconds(Random.Shared.Next(0, 250)));

    private static bool IsAiScheduleGeneration(HttpRequestMessage request) =>
        request.Method == HttpMethod.Post
        && request.RequestUri?.ToString().Contains("optimize-schedule", StringComparison.OrdinalIgnoreCase) == true;
}
