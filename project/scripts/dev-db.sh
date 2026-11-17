#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck disable=SC1091
[ -f .env ] && set -a && source .env && set +a
[ -f backend/.env ] && set -a && source backend/.env && set +a

if ! pg_isready -h localhost -q; then
  echo "Postgres is not running. Start with: brew services start postgresql@15"
  exit 1
fi

MAINT_URL="${DATABASE_URL%/closeloop*}"
MAINT_URL="${MAINT_URL:-postgres://localhost:5432}/postgres?sslmode=disable"

psql "$MAINT_URL" -tc "SELECT 1 FROM pg_database WHERE datname='closeloop'" | grep -q 1 \
  || psql "$MAINT_URL" -c "CREATE DATABASE closeloop"

echo "Database closeloop ready."
