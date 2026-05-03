using FluentValidation;
using SmartStudyPlanner.Application.Subjects.Validators;
using SmartStudyPlanner.Application.Users.Dtos;

namespace SmartStudyPlanner.Application.Users.Validators;

public class OnboardingDtoValidator : AbstractValidator<OnboardingDto>
{
    public OnboardingDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Deadline).NotEmpty();
        RuleForEach(x => x.Subjects).SetValidator(new NewSubjectDtoValidator());
    }
}
