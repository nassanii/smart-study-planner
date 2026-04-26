using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SmartStudyPlanner.Application.Schedule.Dtos.AiPayload;

namespace SmartStudyPlanner.Application.Ai;

public class AiClient : IAiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private readonly HttpClient _http;
    private readonly ILogger<AiClient> _log;

    public AiClient(HttpClient http, ILogger<AiClient> log)
    {
        _http = http;
        _log = log;
    }

    public async Task<AiOptimizeResponseDto> OptimizeScheduleAsync(AiOptimizeRequestDto request, CancellationToken ct)
    {
        using var response = await _http.PostAsJsonAsync("optimize-schedule", request, JsonOptions, ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AiOptimizeResponseDto>(JsonOptions, ct)
            ?? throw new InvalidOperationException("AI service returned an empty body.");
        return body;
    }

    public async Task<JsonElement?> GetPerformanceAsync(int userId, CancellationToken ct)
    {
        using var response = await _http.GetAsync($"analytics/performance/{userId}", ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions, ct);
    }

    public async Task<bool> PingAsync(CancellationToken ct)
    {
        try
        {
            if (_http.BaseAddress is null) return false;
            var rootUri = new Uri(_http.BaseAddress.GetLeftPart(UriPartial.Authority) + "/");
            using var response = await _http.GetAsync(rootUri, ct);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "AI ping failed");
            return false;
        }
    }
}
