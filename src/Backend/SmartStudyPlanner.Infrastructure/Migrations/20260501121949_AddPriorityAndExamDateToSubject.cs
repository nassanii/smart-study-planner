using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartStudyPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPriorityAndExamDateToSubject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "priority",
                table: "subjects",
                type: "INTEGER",
                nullable: false,
                defaultValue: (short)0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "priority",
                table: "subjects");
        }
    }
}
