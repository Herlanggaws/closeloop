# Report test run — 2026-11-18T140900Z

Branch: dev
Result: PASS (UI subset)
Duration: ~4s

## Summary

- Suite: Playwright coach-mark cases R-UI-17, R-UI-18
- Command: `pnpm exec playwright test e2e/reports.spec.ts -g "coach-mark"`
- Also: `pnpm test:unit` (includes `src/lib/tours.test.ts`) — PASS

## Cases

| ID | Result |
|----|--------|
| R-UI-17 Inbox coach-mark tour first visit | PASS |
| R-UI-18 Inbox coach-mark Esc closes tour | PASS |

## Next human action

- None
