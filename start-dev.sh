#!/usr/bin/env bash
#
# Smart Study Planner - one command dev launcher.
# Starts AI, Backend, Android emulator, and Expo Android.
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
ANDROID_PACKAGE="${ANDROID_PACKAGE:-com.smartstudyplanner.app}"
DEFAULT_AVD="${AVD_NAME:-Medium_Phone_API_35_4KB}"
RESET_EMULATOR="${RESET_EMULATOR:-0}"
TARGET_DEVICE="${TARGET_DEVICE:-${DEVICE:-emulator}}"
DEVICE_SERIAL="${DEVICE_SERIAL:-}"

ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
ANDROID_STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"

if [[ -z "${JAVA_HOME:-}" && -d "$ANDROID_STUDIO_JBR" ]]; then
  export JAVA_HOME="$ANDROID_STUDIO_JBR"
fi

export ANDROID_HOME
export ANDROID_SDK_ROOT
export PATH="${JAVA_HOME:+$JAVA_HOME/bin:}$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
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
    export EXPO_PUBLIC_API_BASE_URL="http://10.0.2.2:$API_PORT/api/v1"
  fi
fi

ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"

GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
RED=$'\033[0;31m'
NC=$'\033[0m'

PIDS=()

log() { printf "%b\n" "${CYAN}[dev]${NC} $1"; }
ok() { printf "%b\n" "${GREEN}[ok]${NC} $1"; }
warn() { printf "%b\n" "${YELLOW}[dev]${NC} $1"; }
err() { printf "%b\n" "${RED}[dev]${NC} $1" >&2; }

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
  if ! (cd "$AI_DIR" && python3 -c "import uvicorn, fastapi; from google import genai" >/dev/null 2>&1); then
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

ensure_android_project() {
  if [[ ! -d "$FRONTEND_DIR/android" ]]; then
    log "Generating Android project..."
    (cd "$FRONTEND_DIR" && npx expo prebuild --platform android --no-install)
  fi

  local colors="$FRONTEND_DIR/android/app/src/main/res/values/colors.xml"
  if [[ -f "$colors" ]] && ! grep -q 'name="iconBackground"' "$colors"; then
    log "Adding missing Android iconBackground color..."
    perl -0pi -e 's#</resources>#  <color name="iconBackground">#FFFFFF</color>\n</resources>#' "$colors"
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

choose_avd() {
  local avds
  avds="$("$EMULATOR" -list-avds 2>/dev/null || true)"

  if printf "%s\n" "$avds" | grep -qx "$DEFAULT_AVD"; then
    printf "%s" "$DEFAULT_AVD"
    return 0
  fi

  printf "%s\n" "$avds" | sed '/^$/d' | head -n 1
}

device_booted() {
  "$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | grep -qx "1"
}

choose_phone_device() {
  if [[ -n "$DEVICE_SERIAL" ]]; then
    printf "%s" "$DEVICE_SERIAL"
    return 0
  fi

  "$ADB" devices | awk 'NR > 1 && $2 == "device" && $1 !~ /^emulator-/ { print $1; exit }'
}

run_phone_app() {
  if ! [[ -x "$ADB" ]]; then
    err "Android SDK platform-tools not found. Cannot run on phone."
    exit 1
  fi

  local serial
  serial="$(choose_phone_device)"
  if [[ -z "$serial" ]]; then
    err "No Android phone is connected. Connect it by USB, enable USB debugging, accept the trust prompt, then run again."
    exit 1
  fi

  local model
  model="$("$ADB" -s "$serial" shell getprop ro.product.model 2>/dev/null | tr -d '\r' || true)"
  ok "Android phone is connected: ${model:-$serial} ($serial)"

  log "Starting Expo Android on phone..."
  (cd "$FRONTEND_DIR" && npx expo run:android --device "$serial" --no-build-cache --port "$METRO_PORT")
}

start_emulator() {
  if ! [[ -x "$ADB" && -x "$EMULATOR" ]]; then
    warn "Android SDK tools not found. Skipping emulator."
    return 0
  fi

  if [[ "$RESET_EMULATOR" == "1" ]] && "$ADB" devices | awk 'NR > 1 && $2 == "device" { found = 1 } END { exit !found }'; then
    warn "Restarting Android emulator to reset touch scaling."
    "$ADB" emu kill >/dev/null 2>&1 || true
    sleep 3
  fi

  if "$ADB" devices | awk 'NR > 1 && $2 == "device" { found = 1 } END { exit !found }'; then
    ok "Android device/emulator is already connected"
  else
    local avd
    avd="$(choose_avd)"
    if [[ -z "$avd" ]]; then
      warn "No Android AVD found. Create one in Android Studio first."
      return 0
    fi

    log "Starting Android emulator: $avd"
    nohup "$EMULATOR" -avd "$avd" -gpu host -no-boot-anim -netdelay none -netspeed full \
      -no-snapshot-load -no-snapshot-save -no-hidpi-scaling \
      > "$LOG_DIR/emulator.log" 2>&1 &
  fi

  "$ADB" wait-for-device
  log "Waiting for Android boot..."
  for _ in {1..90}; do
    if device_booted; then
      ok "Android emulator is ready"
      "$ADB" shell input keyevent 82 >/dev/null 2>&1 || true
      "$ADB" shell settings put secure show_ime_with_hard_keyboard 0 >/dev/null 2>&1 || true
      "$ADB" shell wm size reset >/dev/null 2>&1 || true
      "$ADB" shell wm density reset >/dev/null 2>&1 || true
      "$ADB" shell settings put secure accessibility_display_magnification_enabled 0 >/dev/null 2>&1 || true
      return 0
    fi
    sleep 1
  done

  warn "Android emulator did not finish booting yet."
}

open_or_build_android_app() {
  if ! [[ -x "$ADB" ]]; then
    log "Starting Expo Metro only..."
    (cd "$FRONTEND_DIR" && npx expo start -c --port "$METRO_PORT")
    return 0
  fi

  if "$ADB" shell pm path "$ANDROID_PACKAGE" >/dev/null 2>&1; then
    log "Starting Expo Metro..."
    start_bg "Expo Metro" "$FRONTEND_DIR" "$LOG_DIR/metro.log" \
      npx expo start -c --dev-client --port "$METRO_PORT"

    wait_metro

    log "Opening installed Android app..."
    "$ADB" shell am start -n "$ANDROID_PACKAGE/.MainActivity" >/dev/null 2>&1 || true

    # Development builds may stop on the Expo launcher. Open the first green
    # development server automatically so the app screen appears.
    sleep 4
    "$ADB" shell input tap 540 635 >/dev/null 2>&1 || true

    ok "All dev services are running. Press Ctrl+C here to stop them."
    local metro_pid="${PIDS[$((${#PIDS[@]} - 1))]}"
    wait "$metro_pid"
  else
    log "Android app is not installed. Building and installing it now..."
    (cd "$FRONTEND_DIR" && npx expo run:android --no-build-cache --port "$METRO_PORT")
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
  ensure_android_project

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
    start_emulator
    open_or_build_android_app
  fi
}

main "$@"
