using FluentValidation;
using SmartStudyPlanner.Application.Users.Dtos;

namespace SmartStudyPlanner.Application.Users.Validators;

public class RegisterPushTokenDtoValidator : AbstractValidator<RegisterPushTokenDto>
{
    public RegisterPushTokenDtoValidator()
    {
        RuleFor(x => x.PushToken).NotEmpty().MaximumLength(4096);
    }
}
