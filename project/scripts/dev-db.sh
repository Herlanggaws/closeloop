#!/usr/bin/env bash
set -euo pipefail

if ! pg_isready -h localhost -q; then
  echo "Postgres is not running. Start with: brew services start postgresql@15"
  exit 1
fi

psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='closeloop'" | grep -q 1 \
  || createdb closeloop

echo "Database closeloop ready."
