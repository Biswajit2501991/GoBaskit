#!/usr/bin/env bash
# Install GoBaskit as macOS LaunchAgents (24/7, auto-restart, wake recovery).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS_DIR="$HOME/Library/LaunchAgents"
BIN_DIR="$HOME/.gobaskit/bin"
UID_NUM="$(id -u)"

# macOS privacy: LaunchAgents cannot use Desktop/Documents as WorkingDirectory
if [[ "$ROOT" == "$HOME/Desktop/"* ]] || [[ "$ROOT" == "$HOME/Documents/"* ]]; then
  echo "WARNING: Project is on Desktop/Documents — macOS blocks background services there."
  echo "         Recommended: mv \"$ROOT\" \"$HOME/Projects/GoBaskit\" and re-run from there."
  echo "         Attempting workaround (scripts in ~/.gobaskit, home as workdir)..."
fi

echo "==> GoBaskit 24/7 service installer"
echo "    Project: $ROOT"

lsof -ti:3000 | xargs kill 2>/dev/null || true
pkill -f "cloudflared tunnel run" 2>/dev/null || true

echo "==> Building production app..."
cd "$ROOT"
export PATH="/opt/homebrew/bin:$PATH"
npm run build

mkdir -p "$ROOT/logs" "$BIN_DIR"
chmod +x "$ROOT/scripts/"*.sh

# Install wrappers in home (not blocked by macOS privacy)
cat > "$BIN_DIR/serve-app.sh" <<SCRIPT
#!/usr/bin/env bash
exec "$ROOT/scripts/serve-app.sh"
SCRIPT
cat > "$BIN_DIR/serve-tunnel.sh" <<SCRIPT
#!/usr/bin/env bash
exec "$ROOT/scripts/serve-tunnel.sh"
SCRIPT
cat > "$BIN_DIR/health-check.sh" <<SCRIPT
#!/usr/bin/env bash
exec "$ROOT/scripts/health-check.sh"
SCRIPT
cat > "$BIN_DIR/on-wake.sh" <<SCRIPT
#!/usr/bin/env bash
exec "$ROOT/scripts/on-wake.sh"
SCRIPT
chmod +x "$BIN_DIR/"*.sh

# Write plists with HOME workdir (not Desktop)
write_plist() {
  local label=$1 bin=$2
  cat > "$AGENTS_DIR/com.gobaskit.$label.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.gobaskit.$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$BIN_DIR/$bin</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$HOME</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$ROOT/logs/launchd-$label.out.log</string>
  <key>StandardErrorPath</key>
  <string>$ROOT/logs/launchd-$label.err.log</string>
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
}

write_plist app serve-app.sh
write_plist tunnel serve-tunnel.sh

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
    <string>$BIN_DIR/health-check.sh</string>
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

echo "==> Installing LaunchAgents..."
for label in app tunnel healthcheck; do
  launchctl bootout "gui/$UID_NUM/com.gobaskit.$label" 2>/dev/null || true
  launchctl bootstrap "gui/$UID_NUM" "$AGENTS_DIR/com.gobaskit.$label.plist"
  launchctl enable "gui/$UID_NUM/com.gobaskit.$label"
  launchctl kickstart -k "gui/$UID_NUM/com.gobaskit.$label" 2>/dev/null || launchctl start "com.gobaskit.$label"
  echo "    loaded com.gobaskit.$label"
done

if command -v sleepwatcher >/dev/null 2>&1; then
  echo "==> Configuring sleepwatcher wake hook..."
  cat > "$HOME/.wakeup" <<EOF
#!/bin/bash
$BIN_DIR/on-wake.sh
EOF
  chmod +x "$HOME/.wakeup"
  # Start sleepwatcher if not running
  if ! pgrep -x sleepwatcher >/dev/null; then
    brew services start sleepwatcher 2>/dev/null || nohup sleepwatcher -V -w "$HOME/.wakeup" >/dev/null 2>&1 &
  fi
  echo "    ~/.wakeup configured"
else
  echo "==> sleepwatcher not installed — installing for mac sleep/wake auto-recovery..."
  if command -v brew >/dev/null 2>&1; then
    brew install sleepwatcher 2>/dev/null || true
    cat > "$HOME/.wakeup" <<EOF
#!/bin/bash
$BIN_DIR/on-wake.sh
EOF
    chmod +x "$HOME/.wakeup"
    brew services start sleepwatcher 2>/dev/null || nohup sleepwatcher -V -w "$HOME/.wakeup" >/dev/null 2>&1 &
    echo "    sleepwatcher installed + ~/.wakeup configured"
  else
    echo "    WARNING: brew missing — wake recovery may need Manual: brew install sleepwatcher"
  fi
fi

if [[ -f /Library/LaunchDaemons/com.cloudflare.cloudflared.plist ]]; then
  echo ""
  echo "==> Disable conflicting system cloudflared (optional, needs password):"
  echo "    sudo launchctl bootout system/com.cloudflare.cloudflared"
  echo "    sudo cloudflared service uninstall"
fi

echo ""
echo "==> Done. Logs: $ROOT/logs/"
sleep 10
curl -sf --max-time 10 http://127.0.0.1:3000/api/config >/dev/null && echo "    Local:  OK" || echo "    Local:  check logs/launchd-app.err.log"
curl -sf --max-time 20 https://www.gobaskitkaro.com/api/config >/dev/null && echo "    Public: OK" || echo "    Public: check logs/launchd-tunnel.err.log"
