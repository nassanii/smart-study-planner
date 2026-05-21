#!/usr/bin/env bash
set -euo pipefail

export PATH="/tools:$PATH"

mkdir -p /data

dotnet ef database update \
  --project /src/src/Backend/SmartStudyPlanner.Infrastructure/SmartStudyPlanner.Infrastructure.csproj \
  --startup-project /src/src/Backend/SmartStudyPlanner.Api/SmartStudyPlanner.Api.csproj \
  --configuration Release \
  --no-build

exec dotnet /app/SmartStudyPlanner.Api.dll
