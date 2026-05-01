using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartStudyPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnableSubjectCascadeDelete : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_focus_sessions_subjects_subject_id",
                table: "focus_sessions");

            migrationBuilder.DropForeignKey(
                name: "fk_study_tasks_subjects_subject_id",
                table: "study_tasks");

            migrationBuilder.AddForeignKey(
                name: "fk_focus_sessions_subjects_subject_id",
                table: "focus_sessions",
                column: "subject_id",
                principalTable: "subjects",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_study_tasks_subjects_subject_id",
                table: "study_tasks",
                column: "subject_id",
                principalTable: "subjects",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_focus_sessions_subjects_subject_id",
                table: "focus_sessions");

            migrationBuilder.DropForeignKey(
                name: "fk_study_tasks_subjects_subject_id",
                table: "study_tasks");

            migrationBuilder.AddForeignKey(
                name: "fk_focus_sessions_subjects_subject_id",
                table: "focus_sessions",
                column: "subject_id",
                principalTable: "subjects",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "fk_study_tasks_subjects_subject_id",
                table: "study_tasks",
                column: "subject_id",
                principalTable: "subjects",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
