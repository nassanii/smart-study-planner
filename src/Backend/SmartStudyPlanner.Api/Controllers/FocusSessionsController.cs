using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.FocusSessions.Dtos;
using SmartStudyPlanner.Application.FocusSessions.Services;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/focus-sessions")]
public class FocusSessionsController : ControllerBase
{
    private readonly IFocusSessionService _sessions;
    private readonly ICurrentUser _currentUser;

    public FocusSessionsController(IFocusSessionService sessions, ICurrentUser currentUser)
    {
        _sessions = sessions;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FocusSessionDto>>> List([FromQuery] DateOnly? from, [FromQuery] DateOnly? to, CancellationToken ct)
        => Ok(await _sessions.ListAsync(_currentUser.RequireUserId(), from, to, ct));

    [HttpPost]
    public async Task<ActionResult<FocusSessionDto>> Start([FromBody] StartSessionDto dto, CancellationToken ct)
    {
        var s = await _sessions.StartAsync(_currentUser.RequireUserId(), dto, ct);
        return CreatedAtAction(nameof(List), null, s);
    }

    [HttpPatch("{id:int}/complete")]
    public async Task<ActionResult<FocusSessionDto>> Complete(int id, [FromBody] CompleteSessionDto dto, CancellationToken ct)
        => Ok(await _sessions.CompleteAsync(_currentUser.RequireUserId(), id, dto, ct));
}
