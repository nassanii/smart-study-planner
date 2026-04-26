using FluentValidation;
using SmartStudyPlanner.Application.FocusSessions.Dtos;

namespace SmartStudyPlanner.Application.FocusSessions.Validators;

public class CompleteSessionDtoValidator : AbstractValidator<CompleteSessionDto>
{
    public CompleteSessionDtoValidator()
    {
        RuleFor(x => x.DurationSeconds).GreaterThan(0).LessThanOrEqualTo(60 * 60 * 24);
        RuleFor(x => x.FocusRating).InclusiveBetween((short)1, (short)5);
        When(x => x.SnoozeReason is not null, () => RuleFor(x => x.SnoozeReason!).MaximumLength(200));
    }
}
