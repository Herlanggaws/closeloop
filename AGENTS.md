<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Branching & Merge Policy

- **Never commit or push directly to `dev` or `main`.** Always work on and push to a feature branch (`feat/<slug>`, `fix/<slug>`, `chore/<slug>`) branched from `dev`.
- If currently on `dev` or `main`, checkout a new feature branch (`git checkout -b <type>/<slug>`) before committing or pushing.
- Every feature branch must pass the **Lint & Vulnerability Check** (`eslint`, `pnpm audit`, `golangci-lint`, and `govulncheck`) as a required merge blocker before merging into `dev` or `main`.

## Widget Launcher Hover Branding

- The widget launcher button (`button.fab` in `project/frontend/packages/widget/src/index.tsx`) **must always show** the inline `"Feedback by Saidloop"` (`.fab-sub`) hover slider animation across all subscription tiers (`free`, `indie`, `studio`, `business`).
- Never gate `.fab-sub` (`"Feedback by Saidloop"`) behind `badge.on`. `badge.on` only controls the `"Powered by Saidloop"` footer link inside the feedback form, sent confirmation, and notification banner (and reporter emails on Free).
