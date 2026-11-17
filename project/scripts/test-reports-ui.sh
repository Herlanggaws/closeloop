#!/usr/bin/env bash
# L3 Playwright report UI smoke. See docs/AI Report Testing Plan.md §4.6
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
[ -f .env ] && set -a && source .env && set +a
[ -f frontend/.env ] && set -a && source frontend/.env && set +a
[ -f backend/.env ] && set -a && source backend/.env && set +a

export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8080}"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-http://localhost:3000}"
export API_URL="${API_URL:-$NEXT_PUBLIC_API_URL}"

REPORTS_DIR="$REPO_ROOT/docs/reports"
mkdir -p "$REPORTS_DIR"
STAMP="$(date -u +"%Y-%m-%dT%H%M%SZ")"
SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
START_NS="$(date +%s)"
STARTED_STACK=0
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [[ "$STARTED_STACK" -eq 1 ]]; then
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
    jobs -p | xargs -r kill 2>/dev/null || true
  fi
}
trap cleanup EXIT

wait_http() {
  local url="$1"
  local name="$2"
  for _ in $(seq 1 90); do
    if curl -sf --max-time 2 "$url" >/dev/null; then
      echo "$name ready"
      return 0
    fi
    sleep 1
  done
  echo "$name did not become ready at $url" >&2
  return 1
}

if ! curl -sf --max-time 2 "${NEXT_PUBLIC_API_URL}/healthz" >/dev/null; then
  echo "Starting backend for UI tests…"
  STARTED_STACK=1
  bash scripts/dev-db.sh
  bash scripts/migrate.sh
  bash scripts/dev-backend.sh &
  BACKEND_PID=$!
  wait_http "${NEXT_PUBLIC_API_URL}/healthz" "backend"
else
  echo "Reusing backend at ${NEXT_PUBLIC_API_URL}"
fi

if ! curl -sf --max-time 2 "${PLAYWRIGHT_BASE_URL}/" >/dev/null; then
  echo "Starting frontend for UI tests…"
  STARTED_STACK=1
  (
    cd "$ROOT/frontend"
    pnpm --filter @closeloop/widget build
    pnpm dev
  ) &
  FRONTEND_PID=$!
  wait_http "${PLAYWRIGHT_BASE_URL}/" "frontend"
else
  echo "Reusing frontend at ${PLAYWRIGHT_BASE_URL}"
fi

# Ensure widget bundle exists for demo.html
if [[ ! -f "$ROOT/frontend/public/w.js" ]]; then
  (cd "$ROOT/frontend" && pnpm --filter @closeloop/widget build)
fi

echo "Running Playwright report UI suite…"
set +e
(
  cd "$ROOT/frontend"
  pnpm exec playwright test e2e/reports.spec.ts
)
STATUS=$?
set -e

END_NS="$(date +%s)"
DURATION="$((END_NS - START_NS))s"
RESULT="FAIL"
[[ $STATUS -eq 0 ]] && RESULT="PASS"

cat > "$REPORTS_DIR/latest.md" <<EOF
# Report test run — ${STAMP}

Branch: dev @ ${SHA}
Result: ${RESULT}
Duration: ${DURATION}

## Summary

- Suite: Playwright L3 report UI (\`R-UI-01\`…\`R-UI-05\`)
- Base URL: \`${PLAYWRIGHT_BASE_URL}\`
- API: \`${NEXT_PUBLIC_API_URL}\`
- Command: \`pnpm test:reports:ui\` / \`bash scripts/test-reports-ui.sh\`

## Next human action

$(if [[ "$RESULT" == "PASS" ]]; then echo "- None"; else echo "- Inspect Playwright failure output / screenshots under frontend/test-results"; fi)
EOF
cp "$REPORTS_DIR/latest.md" "$REPORTS_DIR/${STAMP}.md"
echo "Wrote $REPORTS_DIR/latest.md"
exit "$STATUS"
