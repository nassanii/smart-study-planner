using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Subjects.Dtos;
using SmartStudyPlanner.Application.Subjects.Services;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/subjects")]
public class SubjectsController : ControllerBase
{
    private readonly ISubjectService _subjects;
    private readonly ICurrentUser _currentUser;

    public SubjectsController(ISubjectService subjects, ICurrentUser currentUser)
    {
        _subjects = subjects;
        _currentUser = currentUser;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SubjectDto>>> List(CancellationToken ct)
        => Ok(await _subjects.ListAsync(_currentUser.RequireUserId(), ct));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SubjectDto>> Get(int id, CancellationToken ct)
        => Ok(await _subjects.GetAsync(_currentUser.RequireUserId(), id, ct));

    [HttpPost]
    public async Task<ActionResult<SubjectDto>> Create([FromBody] NewSubjectDto dto, CancellationToken ct)
    {
        var created = await _subjects.CreateAsync(_currentUser.RequireUserId(), dto, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<SubjectDto>> Update(int id, [FromBody] UpdateSubjectDto dto, CancellationToken ct)
        => Ok(await _subjects.UpdateAsync(_currentUser.RequireUserId(), id, dto, ct));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _subjects.DeleteAsync(_currentUser.RequireUserId(), id, ct);
        return NoContent();
    }
}
