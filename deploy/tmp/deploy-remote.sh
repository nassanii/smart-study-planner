#!/usr/bin/env bash
set -euo pipefail

APP_NAME="smart-study-planner"
TMP_ROOT="/TMP/$APP_NAME"
SOURCE_DIR="${SOURCE_DIR:-$TMP_ROOT/source}"
RUNTIME_DIR="$TMP_ROOT/runtime"
ENV_FILE="$RUNTIME_DIR/.env"
SERVER_IP="${SERVER_IP:-187.77.109.189}"
SSLIP_HOST="${SERVER_IP//./-}.sslip.io"

FRONT_HOST="${FRONT_HOST:-smart-study-project.$SSLIP_HOST}"
API_HOST="${API_HOST:-api.smart-study-project.$SSLIP_HOST}"
AI_HOST="${AI_HOST:-ai.smart-study-project.$SSLIP_HOST}"

FRONT_URL="https://$FRONT_HOST"
API_URL="https://$API_HOST"
AI_URL="https://$AI_HOST"

CADDYFILE="/opt/lisan/ops/caddy/Caddyfile"
MARKER_BEGIN="# BEGIN TMP_SMART_STUDY_PLANNER"
MARKER_END="# END TMP_SMART_STUDY_PLANNER"
PATH_MARKER_BEGIN="# BEGIN TMP_SMART_STUDY_PLANNER_PATHS"
PATH_MARKER_END="# END TMP_SMART_STUDY_PLANNER_PATHS"

mkdir -p "$TMP_ROOT/data/backend" "$RUNTIME_DIR"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

set_env() {
  local key="$1"
  local value="$2"
  local tmp_env

  tmp_env="$(mktemp)"
  grep -v -E "^${key}=" "$ENV_FILE" > "$tmp_env" || true
  printf '%s=%q\n' "$key" "$value" >> "$tmp_env"
  cat "$tmp_env" > "$ENV_FILE"
  rm -f "$tmp_env"
}

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${TMP_JWT_SIGNING_KEY:=$(openssl rand -base64 48)}"
: "${SEED_TOKEN:=$(openssl rand -base64 48)}"

TMP_API_URL="$API_URL"
TMP_FRONT_URL="$FRONT_URL"
TMP_AI_URL="$AI_URL"

set_env "TMP_JWT_SIGNING_KEY" "$TMP_JWT_SIGNING_KEY"
set_env "TMP_API_URL" "$TMP_API_URL"
set_env "TMP_FRONT_URL" "$TMP_FRONT_URL"
set_env "TMP_AI_URL" "$TMP_AI_URL"
set_env "SEED_TOKEN" "$SEED_TOKEN"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

repair_sqlite_migration_history() {
  local db_file="$TMP_ROOT/data/backend/smart_study_planner.db"

  [[ -f "$db_file" ]] || return 0
  command -v python3 >/dev/null 2>&1 || return 0

  python3 - "$db_file" <<'PY'
import sqlite3
import sys

db_file = sys.argv[1]
target = "20260521233500_AddMidtermAndFinalToSubject"

with sqlite3.connect(db_file) as connection:
    cursor = connection.cursor()
    tables = {
        row[0]
        for row in cursor.execute(
            "select name from sqlite_master where type = 'table'"
        )
    }

    if "__EFMigrationsHistory" not in tables or "subjects" not in tables:
        raise SystemExit(0)

    subject_columns = {
        row[1]
        for row in cursor.execute("pragma table_info(subjects)")
    }
    if not {"final_date", "midterm_date"}.issubset(subject_columns):
        raise SystemExit(0)

    history_columns = [
        row[1]
        for row in cursor.execute("pragma table_info(__EFMigrationsHistory)")
    ]
    migration_column = "migration_id" if "migration_id" in history_columns else "MigrationId"
    product_column = "product_version" if "product_version" in history_columns else "ProductVersion"

    migrations = {
        row[0]
        for row in cursor.execute(
            f'select "{migration_column}" from "__EFMigrationsHistory"'
        )
    }
    if target in migrations:
        raise SystemExit(0)

    cursor.execute(
        f'insert into "__EFMigrationsHistory" ("{migration_column}", "{product_column}") values (?, ?)',
        (target, "8.0.10"),
    )
    connection.commit()
    print("Repaired EF migration history for existing subject midterm/final columns.")
PY
}

if ! docker network inspect lisan_default >/dev/null 2>&1; then
  echo "Missing Docker network: lisan_default" >&2
  exit 1
fi

if [[ ! -f "$CADDYFILE" ]]; then
  echo "Missing Caddyfile at $CADDYFILE" >&2
  exit 1
fi

tmp_caddy="$(mktemp)"
awk \
  -v begin="$MARKER_BEGIN" \
  -v end="$MARKER_END" \
  -v path_begin="$PATH_MARKER_BEGIN" \
  -v path_end="$PATH_MARKER_END" '
  $0 == begin || $0 == path_begin { skip = 1; next }
  $0 == end || $0 == path_end { skip = 0; next }
  !skip { print }
' "$CADDYFILE" > "$tmp_caddy"

cat >> "$tmp_caddy" <<EOF_CADDY

$MARKER_BEGIN
$FRONT_HOST {
    encode gzip
    header X-Robots-Tag "noindex, nofollow, noarchive, nosnippet, noimageindex"
    reverse_proxy tmp-smart-frontend:80
}

$API_HOST {
    encode gzip
    header X-Robots-Tag "noindex, nofollow, noarchive, nosnippet, noimageindex"
    reverse_proxy tmp-smart-backend:5080
}

$AI_HOST {
    encode gzip
    header X-Robots-Tag "noindex, nofollow, noarchive, nosnippet, noimageindex"
    reverse_proxy tmp-smart-ai:8000
}
$MARKER_END
EOF_CADDY

cp "$CADDYFILE" "$CADDYFILE.bak.$(date +%Y%m%d%H%M%S)"
cat "$tmp_caddy" > "$CADDYFILE"
rm -f "$tmp_caddy"

cd "$SOURCE_DIR"
repair_sqlite_migration_history
docker compose -f deploy/tmp/docker-compose.yml build
docker compose -f deploy/tmp/docker-compose.yml up -d

docker exec lisan-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec lisan-caddy-1 caddy reload --config /etc/caddy/Caddyfile

seed_ok=0
for attempt in {1..30}; do
  if docker run --rm --network lisan_default curlimages/curl:8.10.1 \
    -fsS --max-time 20 -H "X-Seed-Token: $SEED_TOKEN" \
    -X POST "http://tmp-smart-backend:5080/api/v1/seed"; then
    seed_ok=1
    echo
    break
  fi
  echo "Waiting for backend seed endpoint... attempt $attempt/30"
  sleep 3
done

if [[ "$seed_ok" != "1" ]]; then
  echo "Failed to seed backend database through the internal Docker network" >&2
  exit 1
fi

echo "TMP_FRONT_URL=$FRONT_URL"
echo "TMP_API_HEALTH=$API_URL/health"
echo "TMP_AI_URL=$AI_URL"
