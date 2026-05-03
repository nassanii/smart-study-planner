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

    [HttpGet("day/{date}")]
    public async Task<ActionResult<GenerateScheduleResponse>> GetByDate(DateOnly date, CancellationToken ct)
    {
        var result = await _schedule.GetByDateAsync(_currentUser.RequireUserId(), date, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("history")]
    public async Task<ActionResult<IReadOnlyList<ScheduleSummaryDto>>> History([FromQuery] int limit = 10, CancellationToken ct = default)
        => Ok(await _schedule.GetHistoryAsync(_currentUser.RequireUserId(), limit, ct));

    [HttpPatch("{id:int}/slots/{index:int}/status")]
    public async Task<IActionResult> UpdateSlotStatus(int id, int index, [FromBody] SlotStatusDto status, CancellationToken ct)
    {
        await _schedule.UpdateSlotStatusAsync(_currentUser.RequireUserId(), id, index, status, ct);
        return NoContent();
    }
}
