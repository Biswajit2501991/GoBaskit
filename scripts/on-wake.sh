#!/usr/bin/env bash
# Called after Mac wakes from sleep — restart services (stale TCP after sleep).
set -uo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/logs/wake.log"
mkdir -p "$ROOT/logs"

{
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Wake — restarting GoBaskit services"
  launchctl kickstart -k "gui/$(id -u)/com.gobaskit.app" 2>/dev/null || true
  sleep 3
  launchctl kickstart -k "gui/$(id -u)/com.gobaskit.tunnel" 2>/dev/null || true
} >> "$LOG" 2>&1

# Run health check after services settle
sleep 15
"$ROOT/scripts/health-check.sh"
