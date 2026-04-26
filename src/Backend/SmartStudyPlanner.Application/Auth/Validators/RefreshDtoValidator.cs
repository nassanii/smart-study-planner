using FluentValidation;
using SmartStudyPlanner.Application.Auth.Dtos;

namespace SmartStudyPlanner.Application.Auth.Validators;

public class RefreshDtoValidator : AbstractValidator<RefreshDto>
{
    public RefreshDtoValidator()
    {
        RuleFor(x => x.RefreshToken).NotEmpty().MinimumLength(20);
    }
}
