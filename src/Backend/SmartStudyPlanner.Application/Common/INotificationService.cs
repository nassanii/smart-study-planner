namespace SmartStudyPlanner.Application.Common;

public interface INotificationService
{
    Task SendNotificationAsync(string pushToken, string title, string body, CancellationToken ct = default);
}
