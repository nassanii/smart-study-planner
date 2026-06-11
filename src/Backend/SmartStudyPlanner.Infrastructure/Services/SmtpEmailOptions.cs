namespace SmartStudyPlanner.Infrastructure.Services;

public sealed class SmtpEmailOptions
{
    public bool Enabled { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool EnableSsl { get; set; } = true;
    public bool CheckCertificateRevocation { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 15;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "Smart Study Planner";
}
