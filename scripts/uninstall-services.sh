#!/usr/bin/env bash
set -euo pipefail

UID_NUM="$(id -u)"

echo "==> Stopping GoBaskit LaunchAgents..."
for label in com.gobaskit.app com.gobaskit.tunnel com.gobaskit.healthcheck com.gobaskit.wake; do
  launchctl bootout "gui/$UID_NUM/$label" 2>/dev/null || true
  rm -f "$HOME/Library/LaunchAgents/$label.plist"
done

lsof -ti:3000 | xargs kill 2>/dev/null || true
pkill -f "serve-app.sh" 2>/dev/null || true
pkill -f "serve-tunnel.sh" 2>/dev/null || true

echo "==> Uninstalled. Start manually with: npm run start"
