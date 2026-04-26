using Microsoft.Extensions.Diagnostics.HealthChecks;
using SmartStudyPlanner.Application.Ai;

namespace SmartStudyPlanner.Api.HealthChecks;

public class AiServiceHealthCheck : IHealthCheck
{
    private readonly IAiClient _ai;

    public AiServiceHealthCheck(IAiClient ai)
    {
        _ai = ai;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var ok = await _ai.PingAsync(cancellationToken);
        return ok
            ? HealthCheckResult.Healthy("AI service reachable")
            : HealthCheckResult.Degraded("AI service not reachable");
    }
}
