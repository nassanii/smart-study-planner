#!/usr/bin/env bash
set -euo pipefail

APP_NAME="smart-study-planner"
TMP_ROOT="/TMP/$APP_NAME"
SOURCE_DIR="${SOURCE_DIR:-$TMP_ROOT/source}"
RUNTIME_DIR="$TMP_ROOT/runtime"
ENV_FILE="$RUNTIME_DIR/.env"
SERVER_IP="${SERVER_IP:-187.77.109.189}"
SSLIP_HOST="${SERVER_IP//./-}.sslip.io"

FRONT_HOST="${FRONT_HOST:-tmp-smart.$SSLIP_HOST}"
API_HOST="${API_HOST:-tmp-smart-api.$SSLIP_HOST}"
AI_HOST="${AI_HOST:-tmp-smart-ai.$SSLIP_HOST}"

FRONT_URL="https://$FRONT_HOST"
API_URL="https://$API_HOST"
AI_URL="https://$AI_HOST"

CADDYFILE="/opt/lisan/ops/caddy/Caddyfile"
MARKER_BEGIN="# BEGIN TMP_SMART_STUDY_PLANNER"
MARKER_END="# END TMP_SMART_STUDY_PLANNER"

mkdir -p "$TMP_ROOT/data/backend" "$RUNTIME_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  TMP_JWT_SIGNING_KEY="$(openssl rand -base64 48)"
  {
    printf 'TMP_JWT_SIGNING_KEY=%q\n' "$TMP_JWT_SIGNING_KEY"
    printf 'TMP_API_URL=%q\n' "$API_URL"
    printf 'TMP_FRONT_URL=%q\n' "$FRONT_URL"
    printf 'TMP_AI_URL=%q\n' "$AI_URL"
  } > "$ENV_FILE"
fi

set -a
source "$ENV_FILE"
set +a

if ! docker network inspect lisan_default >/dev/null 2>&1; then
  echo "Missing Docker network: lisan_default" >&2
  exit 1
fi

if [[ ! -f "$CADDYFILE" ]]; then
  echo "Missing Caddyfile at $CADDYFILE" >&2
  exit 1
fi

tmp_caddy="$(mktemp)"
awk -v begin="$MARKER_BEGIN" -v end="$MARKER_END" '
  $0 == begin { skip = 1; next }
  $0 == end { skip = 0; next }
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
docker compose --env-file "$ENV_FILE" -f deploy/tmp/docker-compose.yml build
docker compose --env-file "$ENV_FILE" -f deploy/tmp/docker-compose.yml up -d

docker exec lisan-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec lisan-caddy-1 caddy reload --config /etc/caddy/Caddyfile

echo "TMP_FRONT_URL=$FRONT_URL"
echo "TMP_API_HEALTH=$API_URL/health"
echo "TMP_AI_URL=$AI_URL"
