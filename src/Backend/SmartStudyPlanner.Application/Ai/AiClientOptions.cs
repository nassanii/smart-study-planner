namespace SmartStudyPlanner.Application.Ai;

public class AiClientOptions
{
    public string BaseUrl { get; set; } = "http://localhost:8000/api/v1/";
    public int TimeoutSeconds { get; set; } = 30;
}
