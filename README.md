# Smart Study Planner

AI-powered study planner with three independent services:

| Service | Tech | Port | Folder |
|---|---|---|---|
| **AI Engine** | Python 3.12 · FastAPI · scikit-learn · Gemini | `8000` | [`src/AI`](src/AI) |
| **Backend API** | .NET 8 · ASP.NET Core · EF Core · PostgreSQL · JWT | `5080` | [`src/Backend`](src/Backend) |
| **Mobile/Web App** | Expo SDK 54 · React Native · Axios · AsyncStorage | `8081` (dev) | [`src/Frontend/app`](src/Frontend/app) |

The Backend is the source of truth for users, subjects, tasks, focus sessions and behavioral logs. The AI Engine receives a structured payload from the Backend and returns an optimized daily schedule. The Frontend talks **only** to the Backend.

```
Frontend (Expo)  ───►  Backend (.NET)  ───►  AI Engine (FastAPI)
                            │
                            └──►  PostgreSQL
```

---

## Prerequisites

Install once on your machine:

| Tool | Min version | macOS install |
|---|---|---|
| .NET SDK | 8.0 (LTS) | `brew install --cask dotnet-sdk@8` |
| Python | 3.12 | already on macOS or `brew install python@3.12` |
| Docker Desktop | 25+ | `brew install --cask docker` |
| Node.js | 20.x | `brew install node@20` |
| Expo CLI | bundled with `npx` | — |
| `dotnet-ef` global tool | 8.0.x | `dotnet tool install --global dotnet-ef --version 8.0.10` |
| `openssl` | any | preinstalled |

Verify:
```bash
dotnet --list-sdks      # should list 8.0.x
python3 --version       # 3.12.x
docker --version
node --version          # v20.x
```

---

## One-time setup

Clone the repo and `cd` into it. The rest of this guide assumes the shell is in the repo root:

```bash
cd "/path/to/smart-study-planner"
```

### 1. Postgres (Docker)

```bash
docker compose -f src/Backend/docker-compose.dev.yml up -d
```
This starts a `ssp-postgres` container on `localhost:5432` with database `ssp_dev`, user `ssp`, password `ssp_dev_password`. Data is persisted in a Docker volume so it survives container restarts.

### 2. Apply database migrations

```bash
cd src/Backend
dotnet ef database update \
  --project SmartStudyPlanner.Infrastructure \
  --startup-project SmartStudyPlanner.Api
cd ../..
```
This creates ~15 tables (Identity + domain) inside `ssp_dev`.

### 3. JWT signing key (per developer)

```bash
cd src/Backend/SmartStudyPlanner.Api
dotnet user-secrets init
dotnet user-secrets set "Jwt:SigningKey" "$(openssl rand -base64 48)"
cd ../../..
```
The key is stored in `~/.microsoft/usersecrets/...` outside the repo and never committed.

### 4. Gemini API key (for the AI engine)

Create `src/AI/.env`:
```bash
echo "GEMINI_API_KEY=your_real_gemini_key_here" > src/AI/.env
```

If you don’t have a Gemini key, schedule generation will still call the AI service and persist a row, but the response will carry `hasError: true` and a friendly error message — the rest of the app works normally.

### 5. AI engine Python dependencies

```bash
cd src/AI
pip3 install -r requirements.txt
cd ../..
```

### 6. Frontend dependencies

```bash
cd src/Frontend/app
npm install
cd ../../..
```

### 7. Find your LAN IP and configure the Frontend

Only required if you'll run the app on a phone or Android emulator. Skip if you only use iOS Simulator or web.

```bash
ipconfig getifaddr en0          # e.g. 192.168.1.103
```

Edit [`src/Frontend/app/app.json`](src/Frontend/app/app.json) → `expo.extra.apiBaseUrl`:

| Where you run the app | apiBaseUrl |
|---|---|
| iOS Simulator | `http://localhost:5080/api/v1` |
| Web (`w` in Expo) | `http://localhost:5080/api/v1` |
| Android Emulator | `http://10.0.2.2:5080/api/v1` |
| Expo Go on a phone | `http://<your-LAN-IP>:5080/api/v1` |

---

## Running the project

You need **three terminals** (or one with `tmux`/background processes).

### Terminal 1 — AI engine

```bash
cd src/AI
python3 -m uvicorn main:app --port 8000 --host 0.0.0.0
```
Smoke test:
```bash
curl http://localhost:8000/
# {"message":"Welcome to the AI Engine API! The server is running perfectly."}
```

### Terminal 2 — Backend API

```bash
cd src/Backend/SmartStudyPlanner.Api
ASPNETCORE_ENVIRONMENT=Development \
ASPNETCORE_URLS="http://0.0.0.0:5080" \
  dotnet run --no-launch-profile
```
Smoke tests:
```bash
curl http://localhost:5080/health
# {"status":"Healthy","results":{"database":{...},"aiService":{...}}}

open http://localhost:5080/swagger
# full Swagger UI with JWT 'Authorize' button
```

### Terminal 3 — Frontend (Expo)

```bash
cd src/Frontend/app
npx expo start -c          # -c clears Metro cache (good after edits)
```
Then in the Expo CLI:
- press `w` for **Web** (opens `http://localhost:8081`)
- press `i` for **iOS Simulator**
- press `a` for **Android Emulator**
- scan the QR with **Expo Go** on a phone

### Running everything in one shot (alternative)

For convenience while developing all three together, run each in the background:
```bash
# from repo root
( cd src/AI && nohup python3 -m uvicorn main:app --port 8000 --host 0.0.0.0 > /tmp/ssp-ai.log 2>&1 & )
( cd src/Backend/SmartStudyPlanner.Api && nohup env ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS="http://0.0.0.0:5080" dotnet run --no-launch-profile > /tmp/ssp-api.log 2>&1 & )
( cd src/Frontend/app && nohup npx expo start -c --web > /tmp/ssp-expo.log 2>&1 & )
# logs:
tail -f /tmp/ssp-{ai,api,expo}.log
```

---

## End-to-end happy path

Once all three services are up, walk this flow once to verify everything is wired:

1. Open the Expo app (web or simulator) → **Sign up tab** → enter:
   - Display Name: `ibrahim`
   - Email: `me@test.com`
   - Password: `Test1234`
2. Press **Create Account** → you land on the **Onboarding** screen.
3. Fill the 3 onboarding steps (target GPA, max hours/day, deadline, subjects with difficulty) → press **INITIATE PLAN** → Dashboard appears.
4. **Dashboard** → press **Generate AI Plan** → see strategic summary (or graceful error if Gemini key isn’t set).
5. **Tasks** tab → tap the floating `+` → pick a subject → set difficulty + estimated minutes → **Create AI Task**. Use the controls on each task to bump difficulty, snooze, complete, or delete.
6. **Focus** tab → pick subject and (optional) task → choose Focus / Short / Long → press play. When the timer hits 0, rate the session 1–5 stars → it’s saved and adds to today’s study hours.
7. **Analytics** tab → see real day-streak, snooze rate, planning error from the API.
8. **Profile** tab → **Manage Subjects** → add/edit/delete subjects with the in-app modal. **Log out** uses the styled in-app dialog.

---

## Useful database commands

```bash
# Open psql shell inside the Postgres container
docker exec -it ssp-postgres psql -U ssp -d ssp_dev

# List tables
docker exec ssp-postgres psql -U ssp -d ssp_dev -c "\dt"

# Wipe all data but keep the schema
docker exec ssp-postgres psql -U ssp -d ssp_dev -c "
TRUNCATE \"AspNetUsers\", subjects, study_tasks, focus_sessions,
behavioral_logs, available_slots, ai_schedules, refresh_tokens
RESTART IDENTITY CASCADE;"

# Stop / start Postgres
docker compose -f src/Backend/docker-compose.dev.yml stop
docker compose -f src/Backend/docker-compose.dev.yml start

# Drop everything and recreate (lose all data)
docker compose -f src/Backend/docker-compose.dev.yml down -v
docker compose -f src/Backend/docker-compose.dev.yml up -d
cd src/Backend && dotnet ef database update --project SmartStudyPlanner.Infrastructure --startup-project SmartStudyPlanner.Api
```

---

## API quick reference

Base URL: `http://<host>:5080/api/v1` · all endpoints (except `/auth/register`, `/login`, `/refresh`, `/forgot-password`, `/health`, `/swagger`) require `Authorization: Bearer <accessToken>`.

| Group | Method · Path | Notes |
|---|---|---|
| Auth | `POST /auth/register` | returns access + refresh tokens + user |
| Auth | `POST /auth/login` | |
| Auth | `POST /auth/refresh` | rotates both tokens; reused tokens revoke whole chain |
| Auth | `POST /auth/logout` | revokes provided refresh token |
| Auth | `POST /auth/change-password` | invalidates all refresh tokens for the user |
| Auth | `GET  /auth/me` | current user |
| Users | `PUT  /users/me`, `POST /users/me/onboarding` | atomic onboarding (user + subjects) |
| Subjects | `GET / POST / PUT / DELETE /subjects[/{id}]` | full CRUD |
| Tasks | `GET /tasks?filter=all\|high\|today\|done`, `POST`, `PUT`, `DELETE`, `PATCH /{id}/difficulty`, `POST /{id}/complete`, `POST /{id}/snooze` | side-effects update behavioral logs |
| Focus | `GET /focus-sessions`, `POST` (start), `PATCH /{id}/complete` | rating recorded; streak counters updated |
| Slots | `GET / POST / PUT / DELETE /available-slots[/{id}]` | XOR `dayOfWeek` / `date` |
| Behavioral logs | `GET /behavioral-logs/today`, `GET /behavioral-logs?from=&to=` | server-maintained; no manual writes |
| Schedule | `POST /schedule/generate`, `GET /schedule/today`, `GET /schedule/history?limit=` | calls AI engine, persists `AiSchedule` audit row |
| Analytics | `GET /analytics/insights`, `GET /analytics/performance` | the second one proxies the AI engine |
| Health | `GET /health` | DB + AI engine ping |

Full machine-readable contract: open Swagger at `http://localhost:5080/swagger`.

---

## Running tests

xUnit integration tests live in [`src/Backend/SmartStudyPlanner.Tests`](src/Backend/SmartStudyPlanner.Tests). They use `Testcontainers.PostgreSql` so Docker must be running.

```bash
cd src/Backend
dotnet test
```

---

## Troubleshooting

**“Unauthorized” on Login**
The email exists but the password is wrong. Either reset by truncating the DB (snippet above) or try a new email.

**“This email is already registered”**
The email *is* in the DB. Use a different email or wipe the DB.

**`409` returns from the cached browser**
The Frontend already auto-purges service workers, browser caches and storage on every load (see [`cache_buster.js`](src/Frontend/app/src/services/cache_buster.js)). If you’re still stuck, open an Incognito window or hit `Cmd+Shift+R`.

**`Cannot reach the server`**
The Frontend hit a different host. Re-check `apiBaseUrl` in [`app.json`](src/Frontend/app/app.json) (see the table in §7) and that the Backend is bound to `0.0.0.0:5080`.

**`401 Unauthorized` on `/health` startup**
Health checks are anonymous. If you see this, your reverse proxy is rewriting requests — disable it for `/health`.

**AI engine fails on startup with `NameError: name 'Any' is not defined`**
Re-pull or re-apply the import fix in [`src/AI/ml_models/model_manager.py`](src/AI/ml_models/model_manager.py) (`from typing import Any, ...`).

**Schedule returns `hasError: true`**
Set a valid `GEMINI_API_KEY` in [`src/AI/.env`](src/AI/.env) and restart the AI engine.

**`dotnet ef` not found**
```bash
dotnet tool install --global dotnet-ef --version 8.0.10
echo 'export PATH="$PATH:$HOME/.dotnet/tools"' >> ~/.zshrc && source ~/.zshrc
```

**Stop everything**
```bash
pkill -f "SmartStudyPlanner.Api"
pkill -f "uvicorn main:app"
pkill -f "expo start"
docker compose -f src/Backend/docker-compose.dev.yml stop
```

---

## Project structure

```
smart-study-planner/
├── README.md                          ← you are here
├── src/
│   ├── AI/                            # FastAPI + scikit-learn + Gemini
│   │   ├── main.py
│   │   ├── API/                       # routes
│   │   ├── Core/models/               # Pydantic schemas
│   │   ├── ml_models/                 # personalized burnout + difficulty models
│   │   ├── utils/                     # helpers + visualizer
│   │   ├── requirements.txt
│   │   └── API_CONTRACT.md            # source of truth for the AI ↔ Backend contract
│   │
│   ├── Backend/                       # .NET 8 Clean Architecture
│   │   ├── SmartStudyPlanner.sln
│   │   ├── docker-compose.dev.yml
│   │   ├── Directory.Build.props
│   │   ├── Directory.Packages.props   # central package mgmt (CPM)
│   │   ├── SmartStudyPlanner.Api/
│   │   ├── SmartStudyPlanner.Application/
│   │   ├── SmartStudyPlanner.Domain/
│   │   ├── SmartStudyPlanner.Infrastructure/
│   │   └── SmartStudyPlanner.Tests/
│   │
│   └── Frontend/app/                  # Expo SDK 54
│       ├── App.js
│       ├── app.json                   # apiBaseUrl lives here under expo.extra
│       ├── package.json
│       ├── src/
│       │   ├── context/               # auth_context.js, ai_context.js
│       │   ├── services/              # api_client, api, dialogs, cache_buster, auth_storage
│       │   ├── components/            # SubjectsManager, AppDialogHost, BottomNavigation, ...
│       │   ├── screens/               # LoginScreen, OnboardingScreen, Dashboard, Tasks, Focus, Analytics, Profile, Calendar, Splash
│       │   └── theme/
│       └── assets/
```

---

## Stack notes

- **Backend** uses Clean Architecture (Api → Application → Domain, Infrastructure → Domain + Application). Identity types live in `Application.Identity` so they’re visible to both layers without forcing Domain to depend on `Microsoft.AspNetCore.Identity`.
- **Refresh tokens** are stored as SHA-256 hashes; rotation is enforced and reuse of a revoked token revokes the entire chain.
- **EF Core** uses `EFCore.NamingConventions` for snake_case columns; Identity tables stay PascalCase.
- **Frontend → Backend → AI** uses snake_case JSON only on the AI hop (the Backend translates field names; Backend ↔ Frontend is camelCase).
- **CORS** is permissive in development (`SetIsOriginAllowed(_ => true)`); lock it down for production.
- **Cache-Control: no-store** is sent on every Backend response and on every axios request to defeat browser caching during development.

---

## License

Add your license of choice in `LICENSE` at the repo root.
