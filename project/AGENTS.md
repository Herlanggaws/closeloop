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
- Report automation (plan: `../docs/AI Report Testing Plan.md`; human report: `../docs/reports/latest.md`):
  - API/MCP: `pnpm test:reports` (Go L0/L1/L2 → `closeloop_test`)
  - UI smoke: `pnpm test:reports:ui` (Playwright R-UI-01…05; needs API :8080 + web :3000)
  - Both: `pnpm test:reports:all`
  - Feature work must add/update tests (`.cursor/rules/feature-automation-tests.mdc`).
