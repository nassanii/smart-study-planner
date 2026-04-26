using FluentValidation;
using SmartStudyPlanner.Application.Tasks.Dtos;

namespace SmartStudyPlanner.Application.Tasks.Validators;

public class UpdateDifficultyDtoValidator : AbstractValidator<UpdateDifficultyDto>
{
    public UpdateDifficultyDtoValidator()
    {
        RuleFor(x => x.DifficultyRating).InclusiveBetween((short)1, (short)10);
    }
}
