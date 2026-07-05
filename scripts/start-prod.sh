#!/usr/bin/env bash
set -euo pipefail

# GoBaskit production: Supabase DB + Node server + Cloudflare Tunnel
# Run in two terminals (or use tmux).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building..."
npm run build

echo "==> Starting Next.js on :3000"
echo "    In another terminal: bash scripts/start-tunnel.sh"
echo ""
npm run start
