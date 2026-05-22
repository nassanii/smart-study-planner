using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SmartStudyPlanner.Infrastructure.Persistence;

#nullable disable

namespace SmartStudyPlanner.Infrastructure.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260521233500_AddMidtermAndFinalToSubject")]
    /// <inheritdoc />
    public partial class AddMidtermAndFinalToSubject : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "final_date",
                table: "subjects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "midterm_date",
                table: "subjects",
                type: "TEXT",
                nullable: true);

            migrationBuilder.Sql("UPDATE subjects SET final_date = exam_date WHERE exam_date IS NOT NULL AND final_date IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "final_date",
                table: "subjects");

            migrationBuilder.DropColumn(
                name: "midterm_date",
                table: "subjects");
        }
    }
}
