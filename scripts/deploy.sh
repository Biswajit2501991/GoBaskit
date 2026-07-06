#!/usr/bin/env bash
# Full production deploy — clean build avoids stale chunk / HTML mismatches.
set -euo pipefail

ROOT="${GOBASKIT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export NODE_ENV=production

log() { echo "[deploy $(date -u +%H:%M:%S)] $*"; }

log "Pulling latest..."
git pull --ff-only

log "Running migrations..."
npx prisma migrate deploy

log "Clean build..."
rm -rf .next
npm run build

log "Verifying static chunks exist..."
chunk_count="$(find .next/static/chunks -name '*.js' 2>/dev/null | wc -l | tr -d ' ')"
if [[ "${chunk_count:-0}" -lt 10 ]]; then
  log "Build looks incomplete ($chunk_count JS chunks)"
  exit 1
fi

log "Restarting app..."
launchctl kickstart -k "gui/$(id -u)/com.gobaskit.app"

log "Done."
log "If /checkout still shows 'This page couldn't load', purge Cloudflare cache for /checkout and /_next/static/*"
