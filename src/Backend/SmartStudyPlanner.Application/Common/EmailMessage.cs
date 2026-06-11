namespace SmartStudyPlanner.Application.Common;

public sealed class EmailMessage
{
    public required string ToEmail { get; init; }
    public string? ToName { get; init; }
    public required string Subject { get; init; }
    public required string TextBody { get; init; }
    public string? HtmlBody { get; init; }
}
