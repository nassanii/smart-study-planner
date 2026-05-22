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
        RuleFor(x => x.Subjects).NotEmpty().WithMessage("Add at least one course before finishing setup.");
        // Available slots are optional during onboarding — user can add them later via the AI plan modal.
        RuleForEach(x => x.Subjects).SetValidator(new NewSubjectDtoValidator());
    }
}
