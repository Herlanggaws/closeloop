#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash scripts/dev-db.sh
bash scripts/migrate.sh

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

bash scripts/dev-backend.sh &
bash scripts/dev-frontend.sh &
wait
