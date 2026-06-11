namespace SmartStudyPlanner.Infrastructure.Services;

public class FirebaseNotificationOptions
{
    public bool Enabled { get; set; }
    public string? ProjectId { get; set; }
    public string? CredentialPath { get; set; }
    public string? CredentialJson { get; set; }
    public bool DryRun { get; set; }
}
