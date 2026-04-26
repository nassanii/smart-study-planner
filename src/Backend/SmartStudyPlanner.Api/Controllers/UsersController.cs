using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SmartStudyPlanner.Application.Auth.Dtos;
using SmartStudyPlanner.Application.Auth.Services;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Application.Users.Dtos;
using SmartStudyPlanner.Application.Users.Services;

namespace SmartStudyPlanner.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/users")]
public class UsersController : ControllerBase
{
    private readonly IUserService _users;
    private readonly IAuthService _auth;
    private readonly ICurrentUser _currentUser;

    public UsersController(IUserService users, IAuthService auth, ICurrentUser currentUser)
    {
        _users = users;
        _auth = auth;
        _currentUser = currentUser;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserMeDto>> Me(CancellationToken ct)
        => Ok(await _auth.GetMeAsync(_currentUser.RequireUserId(), ct));

    [HttpPut("me")]
    public async Task<ActionResult<UserMeDto>> Update([FromBody] UpdateUserDto dto, CancellationToken ct)
        => Ok(await _users.UpdateAsync(_currentUser.RequireUserId(), dto, ct));

    [HttpPost("me/onboarding")]
    public async Task<ActionResult<UserMeDto>> Onboard([FromBody] OnboardingDto dto, CancellationToken ct)
        => Ok(await _users.CompleteOnboardingAsync(_currentUser.RequireUserId(), dto, ct));
}
