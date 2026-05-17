#!/usr/bin/env bash
# Update rhymefor.fun production. Runs on the operator's laptop.
# Pulls master, rebuilds, restarts the service, verifies it came up.
set -euo pipefail

REMOTE="deploy@213.199.45.75"

ssh "$REMOTE" '
  set -euo pipefail
  cd ~/rhyme-game
  echo "==> git pull"
  git pull --ff-only
  echo "==> npm ci"
  npm ci
  echo "==> npm run build"
  npm run build
  echo "==> restart service"
  sudo systemctl restart rhyme-game
  echo "==> wait for health"
  for i in $(seq 1 10); do
    if curl -sf http://127.0.0.1:3000/ > /dev/null; then
      echo "OK"
      exit 0
    fi
    sleep 1
  done
  echo "FAILED: app did not come up healthy"
  journalctl -u rhyme-game -n 30 --no-pager 2>/dev/null || true
  exit 1
'
