using FluentValidation;
using SmartStudyPlanner.Application.Tasks.Dtos;

namespace SmartStudyPlanner.Application.Tasks.Validators;

public class NewTaskDtoValidator : AbstractValidator<NewTaskDto>
{
    public NewTaskDtoValidator()
    {
        RuleFor(x => x.SubjectId).GreaterThan(0);
        RuleFor(x => x.Priority).IsInEnum();
        RuleFor(x => x.DifficultyRating).InclusiveBetween((short)1, (short)10);
        RuleFor(x => x.EstimatedMinutes).GreaterThan(0).LessThanOrEqualTo(24 * 60);
        RuleFor(x => x.Tag!).MaximumLength(60).When(x => x.Tag is not null);
    }
}
