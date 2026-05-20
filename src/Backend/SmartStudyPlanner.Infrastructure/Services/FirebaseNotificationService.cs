using FirebaseAdmin;
using FirebaseAdmin.Messaging;
using Google.Apis.Auth.OAuth2;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SmartStudyPlanner.Application.Common;

namespace SmartStudyPlanner.Infrastructure.Services;

public class FirebaseNotificationService : INotificationService
{
    private readonly ILogger<FirebaseNotificationService> _logger;
    private readonly bool _isFirebaseInitialized;

    public FirebaseNotificationService(IConfiguration configuration, ILogger<FirebaseNotificationService> logger)
    {
        _logger = logger;
        
        try
        {
            if (FirebaseApp.DefaultInstance != null)
            {
                _isFirebaseInitialized = true;
                return;
            }

            var serviceAccountJson = configuration["Firebase:ServiceAccountKeyJson"];
            var serviceAccountPath = configuration["Firebase:ServiceAccountKeyPath"];

            AppOptions? options = null;

            if (!string.IsNullOrWhiteSpace(serviceAccountJson))
            {
                options = new AppOptions
                {
                    Credential = GoogleCredential.FromJson(serviceAccountJson)
                };
                _logger.LogInformation("Initializing Firebase SDK from JSON configuration string.");
            }
            else if (!string.IsNullOrWhiteSpace(serviceAccountPath) && System.IO.File.Exists(serviceAccountPath))
            {
                options = new AppOptions
                {
                    Credential = GoogleCredential.FromFile(serviceAccountPath)
                };
                _logger.LogInformation("Initializing Firebase SDK from path: {Path}", serviceAccountPath);
            }

            if (options != null)
            {
                FirebaseApp.Create(options);
                _isFirebaseInitialized = true;
                _logger.LogInformation("Firebase SDK successfully initialized.");
            }
            else
            {
                _logger.LogWarning("Firebase credentials are not configured. Notifications will be logged instead of sent.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Firebase SDK. Falling back to log-only notification mode.");
        }
    }

    public async Task SendNotificationAsync(string pushToken, string title, string body, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(pushToken))
        {
            _logger.LogWarning("Cannot send push notification: Push token is empty.");
            return;
        }

        if (!_isFirebaseInitialized)
        {
            _logger.LogInformation("[MOCK PUSH NOTIFICATION] Token: {Token} | Title: {Title} | Body: {Body}", pushToken, title, body);
            return;
        }

        try
        {
            var message = new Message
            {
                Token = pushToken,
                Data = new Dictionary<string, string>
                {
                    { "title", title },
                    { "body", body },
                    { "experienceId", "@nassani/smart-study-planner" },
                    { "scopeKey", "@nassani/smart-study-planner" }
                },
                Android = new AndroidConfig
                {
                    Priority = Priority.High,
                    TimeToLive = TimeSpan.FromHours(1)
                }
            };

            var response = await FirebaseMessaging.DefaultInstance.SendAsync(message, ct);
            _logger.LogInformation("Successfully sent push notification. Message ID: {MessageId}", response);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending Firebase push notification to token: {Token}", pushToken);
        }
    }
}
