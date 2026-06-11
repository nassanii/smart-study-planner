using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MimeKit;
using SmartStudyPlanner.Application.Common;

namespace SmartStudyPlanner.Infrastructure.Services;

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly SmtpEmailOptions _options;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IOptions<SmtpEmailOptions> options, ILogger<SmtpEmailSender> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        ValidateOptions();

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, _options.TimeoutSeconds)));

        var mail = new MimeMessage();
        mail.From.Add(new MailboxAddress(_options.FromName, _options.FromEmail));
        mail.To.Add(new MailboxAddress(message.ToName ?? message.ToEmail, message.ToEmail));
        mail.Subject = message.Subject;

        var body = new BodyBuilder
        {
            TextBody = message.TextBody,
            HtmlBody = message.HtmlBody
        };
        mail.Body = body.ToMessageBody();

        using var client = new SmtpClient
        {
            Timeout = Math.Max(1, _options.TimeoutSeconds) * 1000,
            CheckCertificateRevocation = _options.CheckCertificateRevocation
        };

        await client.ConnectAsync(_options.Host, _options.Port, ResolveSocketOptions(), timeoutCts.Token);
        await client.AuthenticateAsync(_options.UserName, _options.Password, timeoutCts.Token);
        await client.SendAsync(mail, timeoutCts.Token);
        await client.DisconnectAsync(true, timeoutCts.Token);

        _logger.LogInformation("Email sent through SMTP. To={ToEmail}; Subject={Subject}", message.ToEmail, message.Subject);
    }

    private SecureSocketOptions ResolveSocketOptions()
    {
        if (_options.Port == 465) return SecureSocketOptions.SslOnConnect;
        return _options.EnableSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.None;
    }

    private void ValidateOptions()
    {
        if (string.IsNullOrWhiteSpace(_options.Host))
            throw new InvalidOperationException("Email:Smtp:Host is not configured.");
        if (_options.Port <= 0)
            throw new InvalidOperationException("Email:Smtp:Port is not configured.");
        if (string.IsNullOrWhiteSpace(_options.UserName))
            throw new InvalidOperationException("Email:Smtp:UserName is not configured.");
        if (string.IsNullOrWhiteSpace(_options.Password))
            throw new InvalidOperationException("Email:Smtp:Password is not configured.");
        if (string.IsNullOrWhiteSpace(_options.FromEmail))
            throw new InvalidOperationException("Email:Smtp:FromEmail is not configured.");
    }
}
