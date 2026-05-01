using FluentValidation.AspNetCore;
using SmartStudyPlanner.Api.Common;
using SmartStudyPlanner.Api.HealthChecks;
using SmartStudyPlanner.Api.Middleware;
using SmartStudyPlanner.Application;
using SmartStudyPlanner.Application.Common;
using SmartStudyPlanner.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new FlexibleTimeOnlyConverter());
    options.JsonSerializerOptions.Converters.Add(new FlexibleNullableTimeOnlyConverter());
    options.JsonSerializerOptions.Converters.Add(new FlexibleDateOnlyConverter());
    options.JsonSerializerOptions.Converters.Add(new FlexibleNullableDateOnlyConverter());
});
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUserAccessor>();

builder.Services.AddSwaggerWithJwt();

builder.Services.AddApplication(builder.Configuration);
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddJwtBearerAuth(builder.Configuration);

builder.Services.AddCors(options => options.AddPolicy("ExpoDev", p => p
    .SetIsOriginAllowed(_ => true)
    .AllowAnyHeader()
    .AllowAnyMethod()));

var dbConnection = builder.Configuration.GetConnectionString("AppDb")
    ?? throw new InvalidOperationException("ConnectionStrings:AppDb missing");
builder.Services.AddHealthChecks()
    .AddSqlite(dbConnection, name: "database")
    .AddCheck<AiServiceHealthCheck>("aiService");

var app = builder.Build();

app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ExpoDev");

app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0";
    ctx.Response.Headers["Pragma"] = "no-cache";
    await next();
});

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    ResponseWriter = async (context, report) =>
    {
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            status = report.Status.ToString(),
            results = report.Entries.ToDictionary(
                e => e.Key,
                e => new { status = e.Value.Status.ToString(), description = e.Value.Description })
        });
    }
});

app.Run();

public partial class Program;
