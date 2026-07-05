#!/usr/bin/env bash
set -euo pipefail

# GoBaskit consolidation — macOS note: on case-insensitive volumes,
# "GoBaskit" and "gobasket" are THE SAME folder. Back up lowercase names first.

CANONICAL_DIR="${HOME}/Projects/GoBaskit"
CANONICAL_REMOTE="https://github.com/Biswajit2501991/GoBaskit.git"
DATE_TAG="$(date +%Y%m%d)"

echo "==> 1. Backup local duplicate folders (before touching GoBaskit)"
for dir in "${HOME}/Desktop/gobasket" "${HOME}/Desktop/gobaskit" "${HOME}/Desktop/Go Baskit"; do
  if [ -d "${dir}" ]; then
    backup="${dir}.backup-${DATE_TAG}"
    echo "    ${dir} -> ${backup}"
    mv "${dir}" "${backup}"
  fi
done

echo "==> 2. Clone or update ${CANONICAL_DIR}"
if [ -d "${CANONICAL_DIR}/.git" ] && [ -f "${CANONICAL_DIR}/package.json" ]; then
  cd "${CANONICAL_DIR}"
  git pull origin main
else
  rm -rf "${CANONICAL_DIR}"
  git clone "${CANONICAL_REMOTE}" "${CANONICAL_DIR}"
  cd "${CANONICAL_DIR}"
fi

echo "==> 3. Archive duplicate GitHub repo"
if command -v gh >/dev/null 2>&1; then
  gh repo archive Biswajit2501991/Go-Baskit-New --yes 2>/dev/null || true
fi

echo "==> 4. Done — use: cd ${CANONICAL_DIR} && npm install && npm run dev"
echo "    Commit: $(git log -1 --oneline)"
