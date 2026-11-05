#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8080}"

echo "Building widget → public/w.js…"
pnpm --filter @closeloop/widget build

echo "Starting widget watch + Next on :3000…"
echo "Demo host: http://localhost:3000/demo.html?key=…"
pnpm --filter @closeloop/widget dev &
pnpm dev
