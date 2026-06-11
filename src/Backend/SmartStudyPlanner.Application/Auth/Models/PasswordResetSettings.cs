namespace SmartStudyPlanner.Application.Auth.Models;

public sealed class PasswordResetSettings
{
    public string ResetUrl { get; set; } = "smartstudyplanner://reset_password";
    public int CodeExpiryMinutes { get; set; } = 15;
    public int MaxCodeAttempts { get; set; } = 5;
}
