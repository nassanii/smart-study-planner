#!/usr/bin/env bash
#
# Smart Study Planner - iOS dev launcher.
# Starts AI, Backend, and Expo iOS on Simulator or device.
#

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AI_DIR="$ROOT/src/AI"
BACKEND_DIR="$ROOT/src/Backend/SmartStudyPlanner.Api"
FRONTEND_DIR="$ROOT/src/Frontend/app"
LOG_DIR="$ROOT/.dev-logs"

AI_PORT="${AI_PORT:-8000}"
API_PORT="${API_PORT:-5080}"
METRO_PORT="${METRO_PORT:-8081}"
IOS_BUNDLE_ID="${IOS_BUNDLE_ID:-com.smartstudyplanner.app}"
TARGET_DEVICE="${TARGET_DEVICE:-${DEVICE:-simulator}}"

export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
export ASPNETCORE_URLS="http://0.0.0.0:$API_PORT"

detect_lan_ip() {
  if [[ "$(uname)" == "Darwin" ]] && command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
    return 0
  fi

  ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" { print $2; exit }'
}

LAN_IP="${LAN_IP:-$(detect_lan_ip)}"

if [[ -z "${EXPO_PUBLIC_API_BASE_URL:-}" ]]; then
  if [[ "$TARGET_DEVICE" == "phone" ]]; then
    if [[ -z "$LAN_IP" ]]; then
      err "Could not detect LAN IP. Set LAN_IP=your.mac.ip and run again."
      exit 1
    fi
    export EXPO_PUBLIC_API_BASE_URL="http://$LAN_IP:$API_PORT/api/v1"
    export REACT_NATIVE_PACKAGER_HOSTNAME="${REACT_NATIVE_PACKAGER_HOSTNAME:-$LAN_IP}"
  else
    export EXPO_PUBLIC_API_BASE_URL="http://localhost:$API_PORT/api/v1"
  fi
fi

GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
RED=$'\033[0;31m'
NC=$'\033[0m'

PIDS=()

log() { printf "%b\n" "${CYAN}[dev-ios]${NC} $1"; }
ok() { printf "%b\n" "${GREEN}[ok]${NC} $1"; }
warn() { printf "%b\n" "${YELLOW}[dev-ios]${NC} $1"; }
err() { printf "%b\n" "${RED}[dev-ios]${NC} $1" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing command: $1"
    exit 1
  fi
}

cleanup() {
  local status=$?
  trap - INT TERM EXIT

  echo ""
  log "Stopping dev services..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done

  ok "Logs are in $LOG_DIR"
  exit "$status"
}

trap cleanup INT TERM EXIT

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    warn "Port $port is busy. Killing old process: $pids"
    kill -9 $pids 2>/dev/null || true
  fi
}

wait_url() {
  local name="$1"
  local url="$2"
  local log_file="$3"
  local pid="$4"

  log "Waiting for $name at $url ..."
  for _ in {1..60}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      ok "$name is ready"
      return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
      err "$name exited early. Last log lines:"
      tail -n 40 "$log_file" || true
      exit 1
    fi

    sleep 1
  done

  warn "$name did not answer yet. Continuing. Check $log_file"
}

wait_metro() {
  log "Waiting for Expo Metro at http://localhost:$METRO_PORT ..."
  for _ in {1..90}; do
    if curl -fsS "http://localhost:$METRO_PORT/status" 2>/dev/null | grep -q "packager-status:running"; then
      ok "Expo Metro is ready"
      return 0
    fi
    sleep 1
  done

  warn "Expo Metro did not answer yet."
}

ensure_ai_deps() {
  if ! (cd "$AI_DIR" && python3 -c "import uvicorn, fastapi" >/dev/null 2>&1); then
    log "Installing AI dependencies..."
    (cd "$AI_DIR" && python3 -m pip install -r requirements.txt)
  fi
}

ensure_frontend_deps() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    log "Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && npm install)
  fi
}

ensure_ios_project() {
  if [[ ! -d "$FRONTEND_DIR/ios" ]]; then
    log "Generating iOS project files..."
    (cd "$FRONTEND_DIR" && npx expo prebuild --platform ios --no-install)
  fi
}

start_bg() {
  local name="$1"
  local dir="$2"
  local log_file="$3"
  shift 3

  log "Starting $name..."
  : > "$log_file"
  (
    cd "$dir"
    "$@" >> "$log_file" 2>&1
  ) &
  PIDS+=("$!")
}

run_phone_app() {
  log "Starting Expo on iOS phone/device..."
  (cd "$FRONTEND_DIR" && npx expo run:ios --device --port "$METRO_PORT")
}

boot_ios_simulator() {
  log "Checking for booted iOS simulator..."
  local booted_device
  booted_device="$(xcrun simctl list devices | grep "Booted" | head -n 1 | sed -e 's/^[[:space:]]*//' | cut -d '(' -f 2 | cut -d ')' -f 1 || true)"
  
  if [[ -z "$booted_device" ]]; then
    log "No simulator is booted. Booting default iPhone simulator..."
    # Find the first shutdown iPhone simulator
    local shutdown_device
    shutdown_device="$(xcrun simctl list devices | grep -i "iPhone" | grep "Shutdown" | head -n 1 | sed -e 's/^[[:space:]]*//' | cut -d '(' -f 2 | cut -d ')' -f 1 || true)"
    if [[ -z "$shutdown_device" ]]; then
      err "No available iPhone simulator found in Shutdown state. Please open Simulator app."
      exit 1
    fi
    xcrun simctl boot "$shutdown_device" || true
    open -a Simulator || true
    ok "Simulator booted successfully."
  else
    ok "Found booted simulator: $booted_device"
  fi
}

open_or_build_ios_app() {
  boot_ios_simulator
  
  local booted_device
  booted_device="$(xcrun simctl list devices | grep "Booted" | head -n 1 | sed -e 's/^[[:space:]]*//' | cut -d '(' -f 2 | cut -d ')' -f 1 || true)"
  
  if [[ -n "$booted_device" ]] && xcrun simctl get_app_container "$booted_device" "$IOS_BUNDLE_ID" >/dev/null 2>&1; then
    log "App is already installed on iOS Simulator ($booted_device)."
    log "Starting Expo Metro..."
    start_bg "Expo Metro" "$FRONTEND_DIR" "$LOG_DIR/metro.log" \
      npx expo start -c --dev-client --port "$METRO_PORT"

    wait_metro

    log "Opening app in simulator..."
    xcrun simctl launch "$booted_device" "$IOS_BUNDLE_ID" >/dev/null 2>&1 || true

    ok "All dev services are running. Press Ctrl+C here to stop them."
    local metro_pid="${PIDS[$((${#PIDS[@]} - 1))]}"
    wait "$metro_pid"
  else
    log "App is not installed on iOS simulator. Building and installing it now..."
    (cd "$FRONTEND_DIR" && npx expo run:ios --port "$METRO_PORT")
  fi
}

main() {
  mkdir -p "$LOG_DIR"

  require_cmd dotnet
  require_cmd python3
  require_cmd npm
  require_cmd npx
  require_cmd curl
  require_cmd lsof

  ensure_ai_deps
  ensure_frontend_deps
  ensure_ios_project

  kill_port "$AI_PORT"
  kill_port "$API_PORT"
  kill_port "$METRO_PORT"

  log "Backend URL: http://localhost:$API_PORT"
  log "AI URL:      http://localhost:$AI_PORT"
  log "Expo API:    $EXPO_PUBLIC_API_BASE_URL"

  start_bg "AI engine" "$AI_DIR" "$LOG_DIR/ai.log" \
    python3 -m uvicorn main:app --host 0.0.0.0 --port "$AI_PORT"

  start_bg "Backend API" "$BACKEND_DIR" "$LOG_DIR/backend.log" \
    dotnet run --no-launch-profile

  wait_url "AI engine" "http://localhost:$AI_PORT/" "$LOG_DIR/ai.log" "${PIDS[0]}"
  wait_url "Backend API" "http://localhost:$API_PORT/health" "$LOG_DIR/backend.log" "${PIDS[1]}"

  if [[ "$TARGET_DEVICE" == "phone" ]]; then
    run_phone_app
  else
    open_or_build_ios_app
  fi
}

main "$@"
