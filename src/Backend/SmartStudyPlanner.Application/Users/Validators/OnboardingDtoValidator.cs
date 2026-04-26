using FluentValidation;
using SmartStudyPlanner.Application.Subjects.Validators;
using SmartStudyPlanner.Application.Users.Dtos;

namespace SmartStudyPlanner.Application.Users.Validators;

public class OnboardingDtoValidator : AbstractValidator<OnboardingDto>
{
    public OnboardingDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TargetGpa).InclusiveBetween(0m, 4m);
        RuleFor(x => x.MaxHoursPerDay).GreaterThan(0m).LessThanOrEqualTo(24m);
        RuleFor(x => x.Subjects).NotNull();
        RuleForEach(x => x.Subjects).SetValidator(new NewSubjectDtoValidator());
    }
}
