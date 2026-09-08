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

# Do not abort the whole health-check if .env has a quoting typo.
load_env() {
  if [[ ! -f "$ROOT/.env" ]]; then
    return 0
  fi
  set +u
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env" 2>/dev/null || true
  set +a
  set -u
}

# Hit local Next, then the public host, then the tsx script (same DB).
run_cron_job() {
  local path=$1
  local script=$2
  load_env
  local ok=false
  local site="${NEXT_PUBLIC_SITE_URL:-https://www.gobaskitkaro.com}"
  site="${site%/}"
  if [[ -n "${CRON_SECRET:-}" ]]; then
    # Prefer the live host so VAPID keys match Enable Alerts subscriptions.
    if $public_ok; then
      if curl -sf --max-time 25 -X POST -H "x-cron-secret: $CRON_SECRET" "${site}${path}" >> "$LOG" 2>&1; then
        ok=true
      fi
    fi
    if ! $ok && $local_ok; then
      if curl -sf --max-time 20 -X POST -H "x-cron-secret: $CRON_SECRET" "http://127.0.0.1:3000${path}" >> "$LOG" 2>&1; then
        ok=true
      fi
    fi
  fi
  if ! $ok; then
    (cd "$ROOT" && npx tsx "$script" >> "$LOG" 2>&1) || true
  fi
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

# Reminders and weather must run while the live store is up, even if localhost :3000 is down.
if $local_ok || $public_ok; then
  WEATHER_STAMP="$ROOT/logs/.last-weather-disclaimer"
  if [[ ! -f "$WEATHER_STAMP" ]] || [[ -n "$(find "$WEATHER_STAMP" -mmin +19 2>/dev/null)" ]]; then
    run_cron_job /api/cron/weather-disclaimer scripts/weather-disclaimer.ts
    touch "$WEATHER_STAMP"
  fi

  REMIND_STAMP="$ROOT/logs/.last-unassigned-push"
  if [[ ! -f "$REMIND_STAMP" ]] || [[ -n "$(find "$REMIND_STAMP" -mmin +14 2>/dev/null)" ]]; then
    run_cron_job /api/cron/unassigned-order-reminders scripts/unassigned-order-reminders.ts
    touch "$REMIND_STAMP"
  fi
fi

if $local_ok && $public_ok; then
  log "OK (local + public)"
  PURGE_STAMP="$ROOT/logs/.last-purge"
  if [[ ! -f "$PURGE_STAMP" ]] || [[ -n "$(find "$PURGE_STAMP" -mmin +30 2>/dev/null)" ]]; then
    run_cron_job /api/cron/purge-archived-orders scripts/purge-archived-orders.ts
    touch "$PURGE_STAMP"
  fi
elif $public_ok; then
  log "OK (public only — local :3000 down; reminders still ran)"
fi
