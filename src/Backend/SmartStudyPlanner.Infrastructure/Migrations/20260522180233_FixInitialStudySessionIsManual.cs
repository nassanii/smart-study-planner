using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartStudyPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixInitialStudySessionIsManual : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Seeded "Initial Study Session" rows (created during onboarding) were saved with
            // the default is_manual=true. They are not user-added, so flip them to false so the
            // Focus picker can correctly distinguish AI/seeded blocks from real manual ones.
            migrationBuilder.Sql(@"UPDATE study_tasks SET is_manual = 0 WHERE title = 'Initial Study Session';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"UPDATE study_tasks SET is_manual = 1 WHERE title = 'Initial Study Session';");
        }
    }
}
