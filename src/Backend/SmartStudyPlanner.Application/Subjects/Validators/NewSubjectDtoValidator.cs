using FluentValidation;
using SmartStudyPlanner.Application.Subjects.Dtos;

namespace SmartStudyPlanner.Application.Subjects.Validators;

public class NewSubjectDtoValidator : AbstractValidator<NewSubjectDto>
{
    public NewSubjectDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Difficulty).InclusiveBetween((short)1, (short)10);
        RuleFor(x => x.Priority).InclusiveBetween((short)1, (short)3);
        RuleFor(x => x.EstimatedMinutes).InclusiveBetween(15, 300);
    }
}
