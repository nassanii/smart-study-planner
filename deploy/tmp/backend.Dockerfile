FROM mcr.microsoft.com/dotnet/sdk:8.0

WORKDIR /src

COPY . /src

RUN dotnet restore /src/src/Backend/SmartStudyPlanner.sln \
    && dotnet publish /src/src/Backend/SmartStudyPlanner.Api/SmartStudyPlanner.Api.csproj -c Release -o /app \
    && dotnet tool install --tool-path /tools dotnet-ef --version 8.*

COPY deploy/tmp/backend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV ASPNETCORE_URLS=http://0.0.0.0:5080 \
    ASPNETCORE_ENVIRONMENT=Production

EXPOSE 5080
ENTRYPOINT ["/entrypoint.sh"]
