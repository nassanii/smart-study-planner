using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Identity;
using SmartStudyPlanner.Application.Persistence;
using SmartStudyPlanner.Infrastructure.Persistence;
using SmartStudyPlanner.Infrastructure.Services;

namespace SmartStudyPlanner.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("AppDb")
            ?? throw new InvalidOperationException("ConnectionStrings:AppDb is not configured.");

        services.AddDbContext<AppDbContext>(options => options
            .UseSqlite(connectionString, sqlite => sqlite.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
            .UseSnakeCaseNamingConvention());

        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.Configure<SmtpEmailOptions>(configuration.GetSection("Email:Smtp"));
        var smtpEnabled = bool.TryParse(configuration["Email:Smtp:Enabled"], out var smtpIsEnabled) && smtpIsEnabled;
        if (smtpEnabled)
        {
            services.AddSingleton<IEmailSender, SmtpEmailSender>();
        }
        else
        {
            services.AddSingleton<IEmailSender, ConsoleEmailSender>();
        }

        services.Configure<FirebaseNotificationOptions>(configuration.GetSection("Firebase"));
        var firebaseEnabled = bool.TryParse(configuration["Firebase:Enabled"], out var enabled) && enabled;
        if (firebaseEnabled)
        {
            services.AddSingleton<SmartStudyPlanner.Application.Common.INotificationService, FirebaseNotificationService>();
        }
        else
        {
            services.AddSingleton<SmartStudyPlanner.Application.Common.INotificationService, ConsoleNotificationService>();
        }

        services.AddHostedService<NotificationSchedulerService>();

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;
                options.Password.RequireNonAlphanumeric = true;
                options.User.RequireUniqueEmail = true;
                options.SignIn.RequireConfirmedEmail = false;
                options.Lockout.MaxFailedAccessAttempts = 10;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            })
            .AddRoles<ApplicationRole>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        return services;
    }
}
