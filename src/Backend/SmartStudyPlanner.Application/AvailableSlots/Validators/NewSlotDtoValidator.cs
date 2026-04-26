using FluentValidation;
using SmartStudyPlanner.Application.AvailableSlots.Dtos;

namespace SmartStudyPlanner.Application.AvailableSlots.Validators;

public class NewSlotDtoValidator : AbstractValidator<NewSlotDto>
{
    public NewSlotDtoValidator()
    {
        RuleFor(x => x).Must(x => x.DayOfWeek.HasValue ^ x.Date.HasValue)
            .WithMessage("Exactly one of dayOfWeek or date must be provided.");
        RuleFor(x => x.EndTime).GreaterThan(x => x.StartTime).WithMessage("endTime must be after startTime.");
    }
}
