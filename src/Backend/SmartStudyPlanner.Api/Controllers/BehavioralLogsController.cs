using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.BehavioralLogs.Dtos;
using SmartStudyPlanner.Application.BehavioralLogs.Services;
using SmartStudyPlanner.Application.Common;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/behavioral-logs")]
public class BehavioralLogsController : ControllerBase
{
    private readonly IBehavioralLogService _logs;
    private readonly ICurrentUser _currentUser;

    public BehavioralLogsController(IBehavioralLogService logs, ICurrentUser currentUser)
    {
        _logs = logs;
        _currentUser = currentUser;
    }

    [HttpGet("today")]
    public async Task<ActionResult<BehavioralLogDto>> Today(CancellationToken ct)
        => Ok(await _logs.GetTodayDtoAsync(_currentUser.RequireUserId(), ct));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BehavioralLogDto>>> Range([FromQuery] DateOnly from, [FromQuery] DateOnly to, CancellationToken ct)
        => Ok(await _logs.GetRangeAsync(_currentUser.RequireUserId(), from, to, ct));
}
