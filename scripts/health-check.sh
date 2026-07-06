#!/usr/bin/env bash
# Ping app + public site; kick launchd services if unhealthy (post-sleep / network blip).
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

ROOT="${GOBASKIT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
LOG="$ROOT/logs/health.log"
mkdir -p "$ROOT/logs"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >> "$LOG"; }

restart() {
  local label=$1
  log "Restarting $label"
  launchctl kickstart -k "gui/$(id -u)/$label" 2>/dev/null \
    || launchctl start "$label" 2>/dev/null \
    || true
}

local_ok=false
public_ok=false

if curl -sf --max-time 8 http://127.0.0.1:3000/api/config >/dev/null 2>&1; then
  local_ok=true
fi

if curl -sf --max-time 15 https://www.gobaskitkaro.com/api/config >/dev/null 2>&1; then
  public_ok=true
fi

if ! $local_ok; then
  log "Local app unhealthy"
  restart com.gobaskit.app
fi

if ! $public_ok; then
  log "Public site unhealthy"
  restart com.gobaskit.tunnel
  # App may be fine but tunnel dead — only restart app if local also failed above
fi

if $local_ok && $public_ok; then
  log "OK (local + public)"
  PURGE_STAMP="$ROOT/logs/.last-purge"
  if [[ ! -f "$PURGE_STAMP" ]] || [[ -n "$(find "$PURGE_STAMP" -mmin +30 2>/dev/null)" ]]; then
    if [[ -f "$ROOT/.env" ]]; then
      set -a
      # shellcheck disable=SC1091
      source "$ROOT/.env"
      set +a
    fi
    if [[ -n "${CRON_SECRET:-}" ]]; then
      curl -sf -X POST -H "x-cron-secret: $CRON_SECRET" http://127.0.0.1:3000/api/cron/purge-archived-orders >> "$LOG" 2>&1 \
        || (cd "$ROOT" && npx tsx scripts/purge-archived-orders.ts >> "$LOG" 2>&1) \
        || true
    else
      (cd "$ROOT" && npx tsx scripts/purge-archived-orders.ts >> "$LOG" 2>&1) || true
    fi
    touch "$PURGE_STAMP"
  fi
fi
