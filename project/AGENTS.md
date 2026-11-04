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
- Frontend only: `bash scripts/dev-frontend.sh`
