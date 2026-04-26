using FluentValidation;
using SmartStudyPlanner.Application.Subjects.Dtos;

namespace SmartStudyPlanner.Application.Subjects.Validators;

public class UpdateSubjectDtoValidator : AbstractValidator<UpdateSubjectDto>
{
    public UpdateSubjectDtoValidator()
    {
        When(x => x.Name is not null, () =>
        {
            RuleFor(x => x.Name!).NotEmpty().MaximumLength(120);
        });
        When(x => x.Difficulty is not null, () =>
        {
            RuleFor(x => x.Difficulty!.Value).InclusiveBetween((short)1, (short)10);
        });
    }
}
