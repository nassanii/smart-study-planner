using Microsoft.AspNetCore.Identity;

namespace SmartStudyPlanner.Application.Identity;

public class ApplicationRole : IdentityRole<int>
{
    public ApplicationRole() { }
    public ApplicationRole(string name) : base(name) { }
}
