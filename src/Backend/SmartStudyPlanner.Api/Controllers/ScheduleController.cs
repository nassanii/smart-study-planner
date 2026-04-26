using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Schedule.Dtos;
using SmartStudyPlanner.Application.Schedule.Services;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/schedule")]
public class ScheduleController : ControllerBase
{
    private readonly IScheduleService _schedule;
    private readonly ICurrentUser _currentUser;

    public ScheduleController(IScheduleService schedule, ICurrentUser currentUser)
    {
        _schedule = schedule;
        _currentUser = currentUser;
    }

    [HttpPost("generate")]
    public async Task<ActionResult<GenerateScheduleResponse>> Generate([FromBody] GenerateScheduleRequest dto, CancellationToken ct)
        => Ok(await _schedule.GenerateAsync(_currentUser.RequireUserId(), dto.Date, ct));

    [HttpGet("today")]
    public async Task<ActionResult<GenerateScheduleResponse>> Today(CancellationToken ct)
    {
        var today = await _schedule.GetTodayAsync(_currentUser.RequireUserId(), ct);
        return today is null ? NotFound() : Ok(today);
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<ScheduleSummaryDto>>> History([FromQuery] int limit = 10, CancellationToken ct = default)
        => Ok(await _schedule.GetHistoryAsync(_currentUser.RequireUserId(), limit, ct));
}
