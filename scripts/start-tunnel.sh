#!/usr/bin/env bash
# Start GoBaskit Cloudflare tunnel (uses fresh token + http2).
# The launch-daemon token may be stale — use this until you reinstall the service.
set -euo pipefail

TOKEN=$(cloudflared tunnel token gobaskit 2>/dev/null | tr -d '\n')
exec cloudflared tunnel run --protocol http2 --token "$TOKEN"
