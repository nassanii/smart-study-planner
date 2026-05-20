#!/usr/bin/env bash
#
# Smart Study Planner - one-shot dev launcher.
# Starts the .NET backend (background) and the Expo Metro server (foreground)
# so the QR code shows in your terminal. Press Ctrl+C to stop everything.
#

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/src/Backend/SmartStudyPlanner.Api"
FRONTEND_DIR="$ROOT/src/Frontend/app"
BACKEND_LOG="$ROOT/.dev-backend.log"

GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
RED=$'\033[0;31m'
NC=$'\033[0m'

log() { printf "%b\n" "${CYAN}[dev]${NC} $1"; }
warn() { printf "%b\n" "${YELLOW}[dev]${NC} $1"; }
err() { printf "%b\n" "${RED}[dev]${NC} $1" >&2; }

# Detect the machine's LAN IP (first non-loopback IPv4)
detect_lan_ip() {
  if command -v ipconfig >/dev/null 2>&1 && [[ "$(uname)" == "Darwin" ]]; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
  else
    ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1 || true
  fi
}

LAN_IP="$(detect_lan_ip)"
if [[ -z "$LAN_IP" ]]; then
  warn "Could not detect LAN IP. Falling back to localhost (phone won't reach the backend)."
  LAN_IP="localhost"
fi

API_BASE_URL="http://${LAN_IP}:5080/api/v1"
export EXPO_PUBLIC_API_BASE_URL="$API_BASE_URL"

log "LAN IP detected:    ${GREEN}${LAN_IP}${NC}"
log "API base URL:       ${GREEN}${API_BASE_URL}${NC}"

# Kill anything already on port 5080
if lsof -ti:5080 >/dev/null 2>&1; then
  warn "Port 5080 already in use — killing existing process."
  lsof -ti:5080 | xargs kill -9 2>/dev/null || true
fi

# Start backend in background
log "Starting backend (.NET API)..."
: > "$BACKEND_LOG"
(
  cd "$BACKEND_DIR"
  dotnet run --no-launch-profile --urls "http://0.0.0.0:5080" >> "$BACKEND_LOG" 2>&1
) &
BACKEND_PID=$!

# Cleanup handler
cleanup() {
  echo ""
  log "Stopping dev servers..."
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  # Kill any leftover dotnet processes on 5080
  lsof -ti:5080 2>/dev/null | xargs kill -9 2>/dev/null || true
  log "Done. Backend log saved to: $BACKEND_LOG"
  exit 0
}
trap cleanup INT TERM

# Wait for backend to be healthy (max 60s)
log "Waiting for backend to come up on http://${LAN_IP}:5080 ..."
HEALTH_OK=0
for i in {1..60}; do
  if curl -sf "http://localhost:5080/swagger/index.html" >/dev/null 2>&1 \
    || curl -sf "http://localhost:5080/health" >/dev/null 2>&1 \
    || curl -sf "http://localhost:5080/" >/dev/null 2>&1; then
    HEALTH_OK=1
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    err "Backend exited early. Last log lines:"
    tail -n 30 "$BACKEND_LOG"
    exit 1
  fi
  sleep 1
done

if [[ "$HEALTH_OK" == "1" ]]; then
  log "${GREEN}Backend is up.${NC} Logs streaming to: $BACKEND_LOG"
else
  warn "Backend didn't respond yet, continuing anyway. Check $BACKEND_LOG if requests fail."
fi

echo ""
log "Starting Expo Metro server. Scan the QR with:"
log "  - Expo Go        → quick test (notifications won't work)"
log "  - dev-client APK → full FCM support (after 'eas build')"
echo ""

cd "$FRONTEND_DIR"
exec npx expo start --lan
