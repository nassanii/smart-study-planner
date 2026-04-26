using FluentValidation;
using SmartStudyPlanner.Application.Users.Dtos;

namespace SmartStudyPlanner.Application.Users.Validators;

public class UpdateUserDtoValidator : AbstractValidator<UpdateUserDto>
{
    public UpdateUserDtoValidator()
    {
        When(x => x.Name is not null, () =>
            RuleFor(x => x.Name!).NotEmpty().MaximumLength(200));
    }
}
