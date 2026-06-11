using Microsoft.Extensions.Logging;
using SmartStudyPlanner.Application.Common;

namespace SmartStudyPlanner.Infrastructure.Services;

public sealed class ConsoleEmailSender : IEmailSender
{
    private readonly ILogger<ConsoleEmailSender> _logger;

    public ConsoleEmailSender(ILogger<ConsoleEmailSender> logger)
    {
        _logger = logger;
    }

    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        _logger.LogWarning(
            "Email sending is disabled. To={ToEmail}; Subject={Subject}; Body={Body}",
            message.ToEmail,
            message.Subject,
            message.TextBody);

        return Task.CompletedTask;
    }
}
