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
        RuleFor(x => x.AvailableSlots).NotEmpty().WithMessage("Add at least one study time slot before finishing setup.");
        RuleForEach(x => x.Subjects).SetValidator(new NewSubjectDtoValidator());
    }
}
