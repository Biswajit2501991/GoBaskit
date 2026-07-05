#!/usr/bin/env bash
# Supervised Cloudflare tunnel — fresh token each restart, http2 for stability.
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/logs"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

while true; do
  TOKEN=$(cloudflared tunnel token gobaskit 2>/dev/null | tr -d '\n')
  if [[ -z "$TOKEN" ]]; then
    log "Failed to get tunnel token — retry in 30s (run: cloudflared tunnel login)"
    sleep 30
    continue
  fi

  log "Starting cloudflared tunnel (gobaskit)"
  cloudflared tunnel run --protocol http2 --token "$TOKEN"
  code=$?
  log "Tunnel exited ($code) — restarting in 10s"
  sleep 10
done
