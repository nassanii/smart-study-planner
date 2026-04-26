using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartStudyPlanner.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveGpaAddSlotsToOnboarding : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_users_max_hours_range",
                table: "AspNetUsers");

            migrationBuilder.DropCheckConstraint(
                name: "ck_users_target_gpa_range",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "max_hours_per_day",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "target_gpa",
                table: "AspNetUsers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "max_hours_per_day",
                table: "AspNetUsers",
                type: "numeric(4,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "target_gpa",
                table: "AspNetUsers",
                type: "numeric(3,2)",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_users_max_hours_range",
                table: "AspNetUsers",
                sql: "max_hours_per_day IS NULL OR (max_hours_per_day > 0 AND max_hours_per_day <= 24)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_users_target_gpa_range",
                table: "AspNetUsers",
                sql: "target_gpa IS NULL OR (target_gpa >= 0 AND target_gpa <= 4)");
        }
    }
}
