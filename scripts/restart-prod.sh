#!/usr/bin/env bash
# Restart all GoBaskit 24/7 services (app + tunnel + healthcheck) and verify.
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
ROOT="${GOBASKIT_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
UID_NUM="$(id -u)"
AGENTS_DIR="$HOME/Library/LaunchAgents"

echo "==> Hardening healthcheck LaunchAgent (GOBASKIT_ROOT)..."
cat > "$AGENTS_DIR/com.gobaskit.healthcheck.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.gobaskit.healthcheck</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$HOME/.gobaskit/bin/health-check.sh</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$HOME</string>
  <key>StartInterval</key>
  <integer>180</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$ROOT/logs/health.out.log</string>
  <key>StandardErrorPath</key>
  <string>$ROOT/logs/health.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>HOME</key>
    <string>$HOME</string>
    <key>GOBASKIT_ROOT</key>
    <string>$ROOT</string>
  </dict>
</dict>
</plist>
PLIST

mkdir -p "$ROOT/logs" "$HOME/.gobaskit/bin"
# Refresh wrappers so they always point at the current project root
for name in serve-app serve-tunnel health-check on-wake; do
  cat > "$HOME/.gobaskit/bin/${name}.sh" <<SCRIPT
#!/usr/bin/env bash
exec "$ROOT/scripts/${name}.sh"
SCRIPT
  chmod +x "$HOME/.gobaskit/bin/${name}.sh"
done

# Wake recovery after Mac sleep
cat > "$HOME/.wakeup" <<EOF
#!/bin/bash
$HOME/.gobaskit/bin/on-wake.sh
EOF
chmod +x "$HOME/.wakeup"

echo "==> Reloading LaunchAgents..."
for label in app tunnel healthcheck; do
  launchctl bootout "gui/$UID_NUM/com.gobaskit.$label" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_NUM" "$AGENTS_DIR/com.gobaskit.$label.plist"
  launchctl enable "gui/$UID_NUM/com.gobaskit.$label" 2>/dev/null || true
  launchctl kickstart -k "gui/$UID_NUM/com.gobaskit.$label" 2>/dev/null \
    || launchctl start "com.gobaskit.$label" 2>/dev/null \
    || true
  echo "    restarted com.gobaskit.$label"
done

# Ensure sleepwatcher exists for wake auto-recovery
if command -v sleepwatcher >/dev/null 2>&1; then
  if ! pgrep -x sleepwatcher >/dev/null 2>&1; then
    brew services start sleepwatcher 2>/dev/null \
      || nohup sleepwatcher -V -w "$HOME/.wakeup" >/dev/null 2>&1 &
  fi
  echo "==> sleepwatcher OK (wake recovery)"
else
  echo "==> Installing sleepwatcher for wake recovery..."
  brew install sleepwatcher 2>/dev/null || true
  if command -v sleepwatcher >/dev/null 2>&1; then
    brew services start sleepwatcher 2>/dev/null \
      || nohup sleepwatcher -V -w "$HOME/.wakeup" >/dev/null 2>&1 &
    echo "    sleepwatcher started"
  fi
fi

echo "==> Waiting for app + tunnel..."
ok_local=false
ok_public=false
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf --max-time 5 http://127.0.0.1:3000/api/config >/dev/null 2>&1; then
    ok_local=true
  fi
  if curl -sf --max-time 10 https://www.gobaskitkaro.com/api/config >/dev/null 2>&1; then
    ok_public=true
  fi
  if $ok_local && $ok_public; then
    break
  fi
  sleep 3
done

echo ""
if $ok_local; then echo "    Local  : OK"; else echo "    Local  : FAIL — check $ROOT/logs/launchd-app.err.log"; fi
if $ok_public; then echo "    Public : OK"; else echo "    Public : FAIL — check $ROOT/logs/launchd-tunnel.err.log"; fi
echo ""
echo "24/7 coverage:"
echo "  • com.gobaskit.app        KeepAlive=true (auto-restart on crash)"
echo "  • com.gobaskit.tunnel     KeepAlive=true (auto-restart tunnel)"
echo "  • com.gobaskit.healthcheck every 3 min (restart if unhealthy)"
echo "  • ~/.wakeup + sleepwatcher after Mac sleep"
echo "Done."

$ok_local && $ok_public
