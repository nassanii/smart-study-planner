using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartStudyPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskTypeAndStartTime : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_manual",
                table: "study_tasks",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "start_time",
                table: "study_tasks",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "task_type",
                table: "study_tasks",
                type: "INTEGER",
                nullable: false,
                defaultValue: (short)0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_manual",
                table: "study_tasks");

            migrationBuilder.DropColumn(
                name: "start_time",
                table: "study_tasks");

            migrationBuilder.DropColumn(
                name: "task_type",
                table: "study_tasks");
        }
    }
}
