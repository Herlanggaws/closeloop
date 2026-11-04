#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8080}"

echo "Building widget…"
pnpm --filter @closeloop/widget build

echo "Starting frontend on :3000…"
pnpm --filter @closeloop/widget dev &
pnpm dev
