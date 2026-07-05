#!/usr/bin/env bash
# Supervised Next.js production server — restarts on crash or exit.
set -uo pipefail

ROOT="${GOBASKIT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT" || { echo "Cannot cd to $ROOT — grant Full Disk Access to Terminal, or move project out of Desktop"; exit 1; }
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export NODE_ENV=production

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

mkdir -p "$ROOT/logs"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

while true; do
  if [[ ! -d .next ]]; then
    log "No build found — running npm run build..."
    npm run build || { log "Build failed; retry in 60s"; sleep 60; continue; }
  fi

  log "Starting Next.js on :3000"
  npm run start
  code=$?
  log "Next.js exited ($code) — restarting in 5s"
  sleep 5
done
