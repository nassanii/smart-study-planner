using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SmartStudyPlanner.Application.Common;

namespace SmartStudyPlanner.Infrastructure.Services;

public class FirebaseNotificationService : INotificationService
{
    private static readonly object AppLock = new();
    private static FirebaseApp? App;

    private readonly FirebaseMessaging _messaging;
    private readonly FirebaseNotificationOptions _options;
    private readonly ILogger<FirebaseNotificationService> _logger;

    public FirebaseNotificationService(
        IOptions<FirebaseNotificationOptions> options,
        ILogger<FirebaseNotificationService> logger)
    {
        _options = options.Value;
        _logger = logger;
        _messaging = FirebaseMessaging.GetMessaging(GetOrCreateApp(_options));

        _logger.LogInformation(
            "Firebase notification service initialized. ProjectId: {ProjectId}; DryRun: {DryRun}",
            string.IsNullOrWhiteSpace(_options.ProjectId) ? "(default credential project)" : _options.ProjectId,
            _options.DryRun);
    }

    public async Task SendNotificationAsync(string pushToken, string title, string body, CancellationToken ct = default)
    {
        var token = pushToken.Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("Cannot send Firebase notification: push token is empty.");
            return;
        }

        var message = new Message
        {
            Token = token,
            Notification = new Notification
            {
                Title = title,
                Body = body
            },
            Android = new AndroidConfig
            {
                Priority = Priority.High,
                Notification = new AndroidNotification
                {
                    ChannelId = "default",
                    Sound = "default"
                }
            }
        };

        try
        {
            var messageId = await _messaging.SendAsync(message, _options.DryRun, ct);
            _logger.LogInformation("Firebase notification sent. MessageId: {MessageId}; Title: {Title}", messageId, title);
        }
        catch (FirebaseMessagingException ex)
        {
            _logger.LogWarning(
                ex,
                "Firebase rejected notification '{Title}' for token prefix {TokenPrefix}.",
                title,
                TokenPrefix(token));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send Firebase notification '{Title}'.", title);
        }
    }

    private static FirebaseApp GetOrCreateApp(FirebaseNotificationOptions options)
    {
        lock (AppLock)
        {
            if (App is not null) return App;

            var appOptions = new AppOptions
            {
                Credential = ResolveCredential(options)
            };

            if (!string.IsNullOrWhiteSpace(options.ProjectId))
            {
                appOptions.ProjectId = options.ProjectId.Trim();
            }

            App = FirebaseApp.Create(appOptions);
            return App;
        }
    }

    private static GoogleCredential ResolveCredential(FirebaseNotificationOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.CredentialJson))
        {
            return CredentialFactory.FromJson(options.CredentialJson, JsonCredentialParameters.ServiceAccountCredentialType);
        }

        if (!string.IsNullOrWhiteSpace(options.CredentialPath))
        {
            return CredentialFactory.FromFile(options.CredentialPath, JsonCredentialParameters.ServiceAccountCredentialType);
        }

        return GoogleCredential.GetApplicationDefault();
    }

    private static string TokenPrefix(string token)
        => token.Length <= 8 ? token : token[..8];
}
