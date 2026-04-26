using FluentValidation;
using SmartStudyPlanner.Application.Auth.Dtos;

namespace SmartStudyPlanner.Application.Auth.Validators;

public class LoginDtoValidator : AbstractValidator<LoginDto>
{
    public LoginDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}
