#!/usr/bin/env bash
# Loose coverage gate: every plan case ID must appear as a named test.
# See docs/AI Report Testing Plan.md §4 / Phase D.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend/internal/interfaces/http"
E2E="$ROOT/frontend/e2e/reports.spec.ts"

missing=0

require_go() {
  local id="$1"
  if ! grep -R -q "func Test${id}_" "$BACKEND" --include='*_test.go'; then
    echo "MISSING Go test: Test${id}_*"
    missing=$((missing + 1))
  fi
}

require_ui() {
  local id="$1"
  if ! grep -q "$id" "$E2E"; then
    echo "MISSING Playwright case: $id in e2e/reports.spec.ts"
    missing=$((missing + 1))
  fi
}

echo "Checking report case coverage…"

for n in 01 02 03 04 05 06 07 08; do require_go "R_ING_${n}"; done
for n in 01 02 03 04 05 06 07; do require_go "R_INB_${n}"; done
for n in 01 02 03; do require_go "R_MRG_${n}"; done
for n in 01 02 03 04 05 06; do require_go "R_FIX_${n}"; done
for n in 01 02 03 04; do require_go "R_MCP_${n}"; done
require_go "R_GOLDEN_SC2"

for n in 01 02 03 04 05; do require_ui "R-UI-${n}"; done

if [[ "$missing" -gt 0 ]]; then
  echo "Coverage gate failed: $missing missing case(s)."
  exit 1
fi

echo "Coverage gate OK (ING/INB/MRG/FIX/MCP/GOLDEN + R-UI-01…05)."
