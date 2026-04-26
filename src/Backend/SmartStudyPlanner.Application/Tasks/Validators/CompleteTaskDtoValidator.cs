using FluentValidation;
using SmartStudyPlanner.Application.Tasks.Dtos;

namespace SmartStudyPlanner.Application.Tasks.Validators;

public class CompleteTaskDtoValidator : AbstractValidator<CompleteTaskDto>
{
    public CompleteTaskDtoValidator()
    {
        RuleFor(x => x.ActualMinutes).GreaterThan(0).LessThanOrEqualTo(24 * 60);
    }
}
