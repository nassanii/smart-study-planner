namespace SmartStudyPlanner.Application.Common;

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
