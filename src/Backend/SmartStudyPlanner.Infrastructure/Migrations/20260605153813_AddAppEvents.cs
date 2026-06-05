using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartStudyPlanner.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAppEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_events",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    user_id = table.Column<int>(type: "INTEGER", nullable: false),
                    title = table.Column<string>(type: "TEXT", nullable: false),
                    description = table.Column<string>(type: "TEXT", nullable: true),
                    date = table.Column<DateOnly>(type: "TEXT", nullable: false),
                    start_time = table.Column<TimeOnly>(type: "TEXT", nullable: false),
                    estimated_minutes = table.Column<int>(type: "INTEGER", nullable: false),
                    priority = table.Column<int>(type: "INTEGER", nullable: false),
                    is_completed = table.Column<bool>(type: "INTEGER", nullable: false),
                    created_at = table.Column<string>(type: "TEXT", nullable: false),
                    updated_at = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_app_events", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "app_events");
        }
    }
}
