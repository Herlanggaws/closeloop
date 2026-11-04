#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

# shellcheck disable=SC1091
[ -f .env ] && set -a && source .env && set +a
[ -f ../.env ] && set -a && source ../.env && set +a

export DATABASE_URL="${DATABASE_URL:-postgres://$(whoami)@localhost:5432/closeloop?sslmode=disable}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-me-in-production}"
export STORAGE_ROOT="${STORAGE_ROOT:-$ROOT/.data/uploads}"
export API_URL="${API_URL:-http://localhost:8080}"
export WEB_URL="${WEB_URL:-http://localhost:3000}"
export API_ADDR="${API_ADDR:-:8080}"

mkdir -p "$STORAGE_ROOT"
echo "Starting backend on ${API_ADDR}…"
go run ./cmd/server --mode=all
