using FluentValidation;
using SmartStudyPlanner.Application.Tasks.Dtos;

namespace SmartStudyPlanner.Application.Tasks.Validators;

public class UpdateTaskDtoValidator : AbstractValidator<UpdateTaskDto>
{
    public UpdateTaskDtoValidator()
    {
        When(x => x.SubjectId.HasValue, () => RuleFor(x => x.SubjectId!.Value).GreaterThan(0));
        When(x => x.Priority.HasValue, () => RuleFor(x => x.Priority!.Value).IsInEnum());
        When(x => x.DifficultyRating.HasValue, () =>
            RuleFor(x => x.DifficultyRating!.Value).InclusiveBetween((short)1, (short)10));
        When(x => x.EstimatedMinutes.HasValue, () =>
            RuleFor(x => x.EstimatedMinutes!.Value).GreaterThan(0).LessThanOrEqualTo(24 * 60));
        When(x => x.Status.HasValue, () => RuleFor(x => x.Status!.Value).IsInEnum());
        When(x => x.Tag is not null, () => RuleFor(x => x.Tag!).MaximumLength(60));
    }
}
