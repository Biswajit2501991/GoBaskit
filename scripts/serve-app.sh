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

wait_for_deploy_lock() {
  # deploy.sh sets this while wiping/rebuilding .next so we never start mid-build.
  local waited=0
  while [[ -f "$ROOT/.deploy-lock" ]]; do
    if (( waited % 10 == 0 )); then
      log "Deploy in progress — waiting before start..."
    fi
    sleep 1
    waited=$((waited + 1))
    if (( waited > 600 )); then
      log "Deploy lock stuck >10m — removing stale lock"
      rm -f "$ROOT/.deploy-lock"
      break
    fi
  done
}

while true; do
  wait_for_deploy_lock

  if [[ ! -d .next ]] || [[ ! -f .next/BUILD_ID ]]; then
    if [[ -f "$ROOT/.deploy-lock" ]]; then
      continue
    fi
    log "No complete build found — waiting for deploy (will not build here)..."
    sleep 5
    continue
  fi

  log "Starting Next.js on :3000"
  npm run start
  code=$?
  log "Next.js exited ($code) — restarting in 5s"
  sleep 5
done
