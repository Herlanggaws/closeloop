# Report test run — 2026-11-18T124531Z

Branch: dev @ 6cd5a37
Result: PASS
Duration: 26s

## Summary

- Suite: Playwright L3 report UI (`R-UI-01`…`R-UI-16`) green
- Go: `R-GHISSUE-01`…`03` + githubapp CreateIssue unit tests green via `pnpm test:reports`
- Base URL: `http://localhost:3000`
- API: `http://localhost:8080`
- Command: `pnpm test:reports` + `pnpm test:reports:ui`

## Next human action

- Confirm GitHub App has **Issues: Read and write**, then Create GitHub Issue from a ticket
