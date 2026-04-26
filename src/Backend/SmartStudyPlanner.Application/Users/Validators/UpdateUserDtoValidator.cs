using FluentValidation;
using SmartStudyPlanner.Application.Users.Dtos;

namespace SmartStudyPlanner.Application.Users.Validators;

public class UpdateUserDtoValidator : AbstractValidator<UpdateUserDto>
{
    public UpdateUserDtoValidator()
    {
        When(x => x.Name is not null, () =>
            RuleFor(x => x.Name!).NotEmpty().MaximumLength(200));
        When(x => x.TargetGpa.HasValue, () =>
            RuleFor(x => x.TargetGpa!.Value).InclusiveBetween(0m, 4m));
        When(x => x.MaxHoursPerDay.HasValue, () =>
            RuleFor(x => x.MaxHoursPerDay!.Value).GreaterThan(0m).LessThanOrEqualTo(24m));
    }
}
