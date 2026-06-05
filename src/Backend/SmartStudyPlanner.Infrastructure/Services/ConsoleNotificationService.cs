using Microsoft.Extensions.Logging;
using SmartStudyPlanner.Application.Common;

namespace SmartStudyPlanner.Infrastructure.Services;

public class ConsoleNotificationService : INotificationService
{
    private readonly ILogger<ConsoleNotificationService> _logger;

    public ConsoleNotificationService(ILogger<ConsoleNotificationService> logger)
    {
        _logger = logger;
    }

    public Task SendNotificationAsync(string pushToken, string title, string body, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(pushToken))
        {
            _logger.LogWarning("Cannot send push notification: Push token is empty.");
            return Task.CompletedTask;
        }

        // Just log the push notification details to the console instead of sending it via Firebase
        _logger.LogInformation("[MOCK PUSH NOTIFICATION] Token: {Token} | Title: {Title} | Body: {Body}", pushToken, title, body);
        return Task.CompletedTask;
    }
}
