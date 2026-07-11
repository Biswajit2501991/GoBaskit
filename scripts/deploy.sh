#!/usr/bin/env bash
# Full production deploy — clean build avoids stale chunk / HTML mismatches.
set -euo pipefail

ROOT="${GOBASKIT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export NODE_ENV=production

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

cleanup() {
  rm -f "$ROOT/.deploy-lock"
}
trap cleanup EXIT

log "Pulling latest..."
git pull --ff-only

log "Running migrations..."
npx prisma migrate deploy

# Prevent serve-app KeepAlive from restarting into a half-deleted .next.
log "Locking app during clean build..."
touch "$ROOT/.deploy-lock"

log "Stopping app..."
launchctl kill SIGTERM "gui/$(id -u)/com.gobaskit.app" 2>/dev/null || true
# Stop any stray next start still bound to :3000.
pkill -f "next start -p 3000" 2>/dev/null || true

for i in 1 2 3 4 5 6 7 8 9 10; do
  if ! lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 1
  pkill -f "next start -p 3000" 2>/dev/null || true
done

log "Clean build..."
rm -rf .next
npm run build

log "Verifying static chunks exist..."
chunk_count="$(find .next/static/chunks -name '*.js' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${chunk_count:-0}" -lt 10 ]]; then
  log "Build looks incomplete ($chunk_count JS chunks)"
  exit 1
fi
if [[ ! -f .next/BUILD_ID ]] || [[ ! -f .next/required-server-files.json ]]; then
  log "Build missing required Next.js files"
  exit 1
fi

log "Releasing deploy lock and restarting app..."
rm -f "$ROOT/.deploy-lock"
trap - EXIT

launchctl kickstart -k "gui/$(id -u)/com.gobaskit.app"

# Brief health wait so callers know the new process is up.
ok=false
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf --max-time 5 http://127.0.0.1:3000/api/config >/dev/null 2>&1; then
    ok=true
    break
  fi
  sleep 1
done

if $ok; then
  log "Done — app healthy on :3000"
else
  log "Done — but health check failed; see logs/launchd-app.err.log"
  exit 1
fi

log "If an admin page still shows a load error, hard-reload once or purge Cloudflare cache for /_next/static/*"
