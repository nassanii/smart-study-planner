namespace SmartStudyPlanner.Application.Common;

public interface ICurrentUser
{
    int? UserId { get; }
    string? Email { get; }
    bool IsAuthenticated { get; }
    int RequireUserId();
}
