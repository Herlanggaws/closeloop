# Closeloop agents

- Code lives under `project/`, split into two apps:
  - `backend/` — Go Gin API, MCP, worker, migrations
  - `frontend/` — Next.js app + `packages/widget`, `js-sdk`, `emails`
- M1 scope: auth, projects, web widget, inbox, MCP, reporter notify.
- No Docker. Postgres local. Uploads under `STORAGE_ROOT` (default `project/.data/uploads`).
- Design source: `../closeloop.pen` via Pencil MCP.
- Error shape: `{ "error": { "code": "...", "message": "..." } }`.
- Run both: `pnpm dev` from `project/` (orchestrates scripts).
- Backend only: `bash scripts/dev-backend.sh`
- Frontend only: `bash scripts/dev-frontend.sh` (builds + watches widget → `frontend/public/w.js`)
- Widget demo host: `http://localhost:3000/demo.html?key=pk_…` (see `demo/README.md`)
- Report automation: `pnpm test:reports` (Go L0/L1/L2 against `closeloop_test`). Plan: `../docs/AI Report Testing Plan.md`. Human report: `../docs/reports/latest.md`. Feature work must add/update tests (see `.cursor/rules/feature-automation-tests.mdc`).
