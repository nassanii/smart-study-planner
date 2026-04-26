using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.Analytics.Dtos;
using SmartStudyPlanner.Application.Analytics.Services;
using SmartStudyPlanner.Application.Common;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/analytics")]
public class AnalyticsController : ControllerBase
{
    private readonly IAnalyticsService _analytics;
    private readonly ICurrentUser _currentUser;

    public AnalyticsController(IAnalyticsService analytics, ICurrentUser currentUser)
    {
        _analytics = analytics;
        _currentUser = currentUser;
    }

    [HttpGet("insights")]
    public async Task<ActionResult<InsightsDto>> Insights(CancellationToken ct)
        => Ok(await _analytics.GetInsightsAsync(_currentUser.RequireUserId(), ct));

    [HttpGet("performance")]
    public async Task<ActionResult<JsonElement>> Performance(CancellationToken ct)
    {
        var perf = await _analytics.GetAiPerformanceAsync(_currentUser.RequireUserId(), ct);
        return perf is null ? NotFound() : Ok(perf);
    }
}
