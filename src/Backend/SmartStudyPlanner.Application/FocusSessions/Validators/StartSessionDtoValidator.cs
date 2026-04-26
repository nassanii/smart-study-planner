using FluentValidation;
using SmartStudyPlanner.Application.FocusSessions.Dtos;

namespace SmartStudyPlanner.Application.FocusSessions.Validators;

public class StartSessionDtoValidator : AbstractValidator<StartSessionDto>
{
    public StartSessionDtoValidator()
    {
        RuleFor(x => x.SubjectId).GreaterThan(0);
        RuleFor(x => x.Mode).IsInEnum();
        When(x => x.TaskId.HasValue, () => RuleFor(x => x.TaskId!.Value).GreaterThan(0));
    }
}
