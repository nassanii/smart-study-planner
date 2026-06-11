using FluentValidation;
using SmartStudyPlanner.Application.Auth.Dtos;

namespace SmartStudyPlanner.Application.Auth.Validators;

public class VerifyResetCodeDtoValidator : AbstractValidator<VerifyResetCodeDto>
{
    public VerifyResetCodeDtoValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Code)
            .NotEmpty()
            .Matches(@"^\d{5}$").WithMessage("Reset code must be exactly 5 digits.");
    }
}
