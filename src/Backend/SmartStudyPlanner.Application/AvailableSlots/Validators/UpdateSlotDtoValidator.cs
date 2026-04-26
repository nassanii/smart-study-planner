using FluentValidation;
using SmartStudyPlanner.Application.AvailableSlots.Dtos;

namespace SmartStudyPlanner.Application.AvailableSlots.Validators;

public class UpdateSlotDtoValidator : AbstractValidator<UpdateSlotDto>
{
    public UpdateSlotDtoValidator()
    {
        When(x => x.DayOfWeek.HasValue && x.Date.HasValue, () =>
            RuleFor(x => x).Must(_ => false).WithMessage("Cannot set both dayOfWeek and date."));

        When(x => x.StartTime.HasValue && x.EndTime.HasValue, () =>
            RuleFor(x => x.EndTime!.Value).GreaterThan(x => x.StartTime!.Value).WithMessage("endTime must be after startTime."));
    }
}
