#!/usr/bin/env bash
# Run Closeloop report automation suite (L0/L1/L2). See docs/AI Report Testing Plan.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
[ -f .env ] && set -a && source .env && set +a
[ -f backend/.env ] && set -a && source backend/.env && set +a

USER_NAME="${USER:-$(whoami)}"
TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://${USER_NAME}@localhost:5432/closeloop_test?sslmode=disable}"
export TEST_DATABASE_URL
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-me-in-production}"

REPORTS_DIR="$REPO_ROOT/docs/reports"
mkdir -p "$REPORTS_DIR"
STAMP="$(date -u +"%Y-%m-%dT%H%M%SZ")"
SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
START_NS="$(date +%s)"

if [[ -z "${CI:-}" ]]; then
  if ! pg_isready -h localhost -q; then
    echo "Postgres is not running. Start with: brew services start postgresql@15"
    exit 1
  fi
  psql -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='closeloop_test'" | grep -q 1 \
    || createdb closeloop_test
else
  echo "CI mode — using provided TEST_DATABASE_URL (service container)"
fi

echo "Using TEST_DATABASE_URL=${TEST_DATABASE_URL}"
echo "Running report suite…"

set +e
(
  cd "$ROOT/backend"
  go test ./internal/interfaces/http/ ./internal/infrastructure/email/ ./internal/application/ \
    -count=1 \
    -parallel 1 \
    -p 1 \
    -timeout 180s
)
STATUS=$?
set -e

END_NS="$(date +%s)"
DURATION="$((END_NS - START_NS))s"

if [[ $STATUS -eq 0 ]]; then
  RESULT="PASS"
else
  RESULT="FAIL"
fi

write_report() {
  local latest="$REPORTS_DIR/latest.md"
  local archived="$REPORTS_DIR/${STAMP}.md"
  cat > "$latest" <<EOF
# Report test run — ${STAMP}

Branch: dev @ ${SHA}
Result: ${RESULT}
Duration: ${DURATION}

## Summary

- Suite: \`go test\` report L0/L1/L2 (+ existing package tests)
- Database: \`closeloop_test\`
- Command: \`pnpm test:reports\` / \`bash scripts/test-reports.sh\`

## Next human action

$(if [[ "$RESULT" == "PASS" ]]; then echo "- None"; else echo "- Open failing TestR_* output above; agent should auto-fix per docs/AI Report Testing Plan.md §6"; fi)
EOF
  cp "$latest" "$archived"
  echo "Wrote $latest"
}

write_report
exit "$STATUS"
