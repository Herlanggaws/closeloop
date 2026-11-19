# Report test run — 2026-11-19T072000Z

Branch: dev (pricing update D-01…D-09, D-22)
Result: PASS
Duration: ~20s UI, ~16s Go

## Summary

- Go API/MCP: `go test ./...` in `project/backend` — PASS, includes new `TestPlan_*` (QUOTA_LOCKED, Free token migration, integration and board gating, grandfathering, Business not self-serve, usage.repos) and `TestTicketDetailListsReporters`
- Playwright L3 report UI: `pnpm exec playwright test e2e/reports.spec.ts` — 18/18 PASS, includes new R-UI-19 (Free locks Slack/GitHub Issues/Linear/Jira)
- Marketing: `pnpm exec playwright test e2e/marketing.spec.ts` — 13/13 PASS, includes landing 3-card pricing check
- Unit: `pnpm test:unit` — 61/61 PASS

## Test fixes in this run

- e2e sessions now keep coach-mark tours off unless a test is about tours (R-UI-17, R-UI-18 opt in). The Inbox tour was covering the filters, which failed R-UI-02/03/04 before these changes too.
- Board tests seed an Indie org, since publishing to the public board now needs Indie.
- R-UI-07 uses `.first()` because the idea title and description share the same text.

## Next human action

- None
