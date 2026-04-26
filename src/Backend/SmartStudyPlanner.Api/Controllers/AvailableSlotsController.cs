using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.AvailableSlots.Dtos;
using SmartStudyPlanner.Application.AvailableSlots.Services;
using SmartStudyPlanner.Application.Common;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/available-slots")]
public class AvailableSlotsController : ControllerBase
{
    private readonly IAvailableSlotService _slots;
    private readonly ICurrentUser _currentUser;

    public AvailableSlotsController(IAvailableSlotService slots, ICurrentUser currentUser)
    {
        _slots = slots;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AvailableSlotDto>>> List([FromQuery] DateOnly? date, CancellationToken ct)
        => Ok(await _slots.ListForDateAsync(_currentUser.RequireUserId(), date, ct));

    [HttpPost]
    public async Task<ActionResult<AvailableSlotDto>> Create([FromBody] NewSlotDto dto, CancellationToken ct)
        => Ok(await _slots.CreateAsync(_currentUser.RequireUserId(), dto, ct));

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AvailableSlotDto>> Update(int id, [FromBody] UpdateSlotDto dto, CancellationToken ct)
        => Ok(await _slots.UpdateAsync(_currentUser.RequireUserId(), id, dto, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _slots.DeleteAsync(_currentUser.RequireUserId(), id, ct);
        return NoContent();
    }
}
