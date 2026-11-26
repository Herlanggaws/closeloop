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

- Decided by Herlangga on 23 Nov 2026 (replaces the 22 Nov rule): the inline `"Feedback by Saidloop"` (`.fab-sub`) hover slider on the widget launcher (`button.fab` in `project/frontend/packages/widget/src/index.tsx`) shows **on Free only**, gated by `badge.on` like every other Saidloop badge.
- `badge.on` (Free only) controls the launcher hover, the `"Powered by Saidloop"` link in the feedback form, sent confirmation and notification banner, reporter emails, and the public board footer. Paid plans show no Saidloop branding.
