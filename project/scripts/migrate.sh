#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[ -f .env ] && set -a && source .env && set +a
[ -f backend/.env ] && set -a && source backend/.env && set +a
export DATABASE_URL="${DATABASE_URL:-postgres://$(whoami)@localhost:5432/closeloop?sslmode=disable}"
bash scripts/dev-db.sh
cd backend
go run ./cmd/server --mode=migrate
