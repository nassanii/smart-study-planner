namespace SmartStudyPlanner.Application.Ai;

public class AiClientOptions
{
    public string BaseUrl { get; set; } = "https://ai.smart-study-project.187-77-109-189.sslip.io/api/v1/";
    public int TimeoutSeconds { get; set; } = 30;
}
