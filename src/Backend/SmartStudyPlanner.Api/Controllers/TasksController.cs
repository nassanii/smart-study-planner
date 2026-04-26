using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Tasks.Dtos;
using SmartStudyPlanner.Application.Tasks.Services;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/tasks")]
public class TasksController : ControllerBase
{
    private readonly ITaskService _tasks;
    private readonly ICurrentUser _currentUser;

    public TasksController(ITaskService tasks, ICurrentUser currentUser)
    {
        _tasks = tasks;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TaskDto>>> List([FromQuery] string filter = "all", CancellationToken ct = default)
    {
        var parsed = Enum.TryParse<TaskFilter>(filter, ignoreCase: true, out var f) ? f : TaskFilter.All;
        return Ok(await _tasks.ListAsync(_currentUser.RequireUserId(), parsed, ct));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<TaskDto>> Get(int id, CancellationToken ct)
        => Ok(await _tasks.GetAsync(_currentUser.RequireUserId(), id, ct));

    [HttpPost]
    public async Task<ActionResult<TaskDto>> Create([FromBody] NewTaskDto dto, CancellationToken ct)
    {
        var created = await _tasks.CreateAsync(_currentUser.RequireUserId(), dto, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<TaskDto>> Update(int id, [FromBody] UpdateTaskDto dto, CancellationToken ct)
        => Ok(await _tasks.UpdateAsync(_currentUser.RequireUserId(), id, dto, ct));

    [HttpPatch("{id:int}/difficulty")]
    public async Task<ActionResult<TaskDto>> UpdateDifficulty(int id, [FromBody] UpdateDifficultyDto dto, CancellationToken ct)
        => Ok(await _tasks.UpdateDifficultyAsync(_currentUser.RequireUserId(), id, dto.DifficultyRating, ct));

    [HttpPost("{id:int}/complete")]
    public async Task<ActionResult<TaskDto>> Complete(int id, [FromBody] CompleteTaskDto dto, CancellationToken ct)
        => Ok(await _tasks.CompleteAsync(_currentUser.RequireUserId(), id, dto.ActualMinutes, ct));

    [HttpPost("{id:int}/snooze")]
    public async Task<ActionResult<TaskDto>> Snooze(int id, [FromBody] SnoozeTaskDto dto, CancellationToken ct)
        => Ok(await _tasks.SnoozeAsync(_currentUser.RequireUserId(), id, dto.Reason, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _tasks.DeleteAsync(_currentUser.RequireUserId(), id, ct);
        return NoContent();
    }
}
