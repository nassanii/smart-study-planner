using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Events.Dtos;
using SmartStudyPlanner.Application.Events.Services;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class EventsController : ControllerBase
{
    private readonly IEventService _eventService;
    private readonly ICurrentUser _currentUser;

    public EventsController(IEventService eventService, ICurrentUser currentUser)
    {
        _eventService = eventService;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<List<EventDto>>> List(CancellationToken ct)
    {
        var events = await _eventService.ListAsync(_currentUser.RequireUserId(), ct);
        return Ok(events);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<EventDto>> Get(int id, CancellationToken ct)
    {
        var ev = await _eventService.GetByIdAsync(id, _currentUser.RequireUserId(), ct);
        return Ok(ev);
    }

    [HttpPost]
    public async Task<ActionResult<EventDto>> Create([FromBody] CreateEventDto dto, CancellationToken ct)
    {
        var ev = await _eventService.CreateAsync(_currentUser.RequireUserId(), dto, ct);
        return CreatedAtAction(nameof(Get), new { id = ev.Id }, ev);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<EventDto>> Update(int id, [FromBody] UpdateEventDto dto, CancellationToken ct)
    {
        var ev = await _eventService.UpdateAsync(id, _currentUser.RequireUserId(), dto, ct);
        return Ok(ev);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id, CancellationToken ct)
    {
        await _eventService.DeleteAsync(id, _currentUser.RequireUserId(), ct);
        return NoContent();
    }
}
