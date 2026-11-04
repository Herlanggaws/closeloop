# Closeloop Kanban

Nov 4, 2026 · Status against [PRD Closeloop MVP](./PRD%20Closeloop%20MVP.md), [User Stories & Screens](./Closeloop%20User%20Stories%20dan%20Screens.md), and [Tech Plan](./Tech%20Plan%20Closeloop%20MVP.md).

Legend: **Done** = shipped and usable · **Design** = pixel-perfect UI from `closeloop.pen`, not fully wired · **WIP** = partial backend/frontend · **Todo** = not started.

---

## Board

### Done

| ID | Item | Notes |
| --- | --- | --- |
| DES | Design system foundations | Tokens + `/design-system` review page |
| DES | S-01…S-27 pixel screens | Exported from pen → Next routes under `/app/*`, `/board/*`, `/preview/*` |
| DES | Landing (S-01) | Pixel match, waitlist CTAs → signup |
| F1 | Email register / login (S-02) | JWT session; Google button UI only |
| F1 | Create project API | `POST /api/projects`, public key issued |
| F1 | MCP token create | Shown once; hashed storage |
| F2 | Ingest API | `POST /v1/ingest/reports`, upload, complete, identify, updates |
| F2 | Web widget package | `@closeloop/widget` (Preact) present |
| F4 | Tickets API | List, get, patch status, notes, merge |
| F5 | MCP tools | `list_open_feedback`, `get_feedback_context`, `update_status`, `add_note`, `mark_fixed` |
| F6 | mark_fixed → notify path | Backend path exists (email/banner plumbing partial) |
| TECH | Monorepo skeleton | Go API + Next frontend + widget / emails / js-sdk packages |
| TECH | Preview index | `/preview` lists all design screens |

### Design-only (UI done · wire next)

| Screen | Route | Wire to |
| --- | --- | --- |
| S-03 Create project | `/app/onboarding` | Live create-project form + platforms |
| S-04 Install widget | `/app/install` | Real public key + snippet + first-report wait |
| S-05 Connect MCP | `/app/mcp` | Create token + Cursor/Claude config copy |
| S-06 Inbox (+ empty) | `/app/inbox`, `/app/inbox/empty` | Filters, selection, live ticket list |
| S-07 Report detail | `/app/tickets/[id]` | Screenshot, context, status, notes |
| S-08 Merge duplicates | `/app/inbox/merge` | Multi-select → merge API |
| S-09 Mark fixed + notify | `/app/tickets/[id]/fixed` | Note + preview + `mark_fixed` |
| S-10 Auto PR runs | `/app/auto-pr` | Runs list when F10 ships |
| S-11 Manage public board | `/app/board` | Publish flags, roadmap columns |
| S-12 Project settings | `/app/settings` | Keys, masking selectors, notify toggle |
| S-13 Integrations | `/app/settings/integrations` | OAuth connects (F8/F10) |
| S-14 Team & roles | `/app/settings/team` | Invite + roles (US-05) |
| S-15 Billing & credits | `/app/settings/billing` | Manual plan now; MoR later |
| S-16 SSO & audit | `/app/settings/sso` | Business (F12) |
| S-17 Self-host license | `/app/settings/self-host` | Business (F12) |
| S-18…S-21 Widget UX | `/preview/widget/*` | Ship in real widget bundle |
| S-22 Mobile report sheet | `/preview/widget/mobile` | Needs F3 SDK |
| S-23 / S-27 Emails | `/preview/email/*` | React Email + Resend |
| S-24…S-26 Public board | `/board`, `/idea`, `/roadmap` | SSR board + votes |

### Todo — by PRD feature

#### M0 · Validasi
- [ ] Landing waitlist capture (email → store / ESP), not only signup CTA
- [ ] Interview 5–10 builders; log “mau coba minggu ini”
- [ ] Final name + domain
- [ ] Pick Lemon Squeezy vs Paddle (billing still manual `plan` for now)

#### M1 · Inti web (F1, F2, F4, F5, F6) — priority
- [ ] **F1** Google OAuth
- [ ] **F1** Multi-project UI + plan limits
- [ ] **F1** MCP token rotate / revoke UI
- [ ] **F1** Team invite + roles (US-05) — API + S-14
- [ ] **F2** Widget: shadow DOM launcher, auto screenshot, masking, confirm (S-18…S-20) on CDN
- [ ] **F2** Sensitive selectors from project settings applied before capture
- [ ] **F4** Wire inbox + detail to API (replace static design shells)
- [ ] **F4** Filters (type, status, platform), bulk select, empty state logic
- [ ] **F4** Sentry / PostHog deep links when integration present
- [ ] **F5** One-click Cursor / Claude Code install docs from S-05
- [ ] **F5** Free-plan read-only MCP enforcement end-to-end
- [ ] **F6** Resend email on fixed (S-23 template)
- [ ] **F6** In-app fixed banner via ingest updates (S-21)
- [ ] **F6** Per-project notify kill switch (S-12)
- [ ] Dogfood: 100% Bear Budget feedback via Closeloop (no SSH + psql)

#### M2 · Mobile (F3, F7)
- [ ] **F3** Android Kotlin SDK (shake / `show()`, offline queue, masking)
- [ ] **F3** iOS Swift Package
- [ ] **F3** Dogfood on Bear Budget KMP
- [ ] **F7** Flutter package (pub.dev)
- [ ] **F7** React Native + Expo config plugin

#### M3 · Tool tim & publik (F8, F9, F11)
- [ ] **F8** Slack new-report + status notifications
- [ ] **F8** GitHub Issues / Linear / Jira create + bi-directional status
- [ ] **F9** Public board SSR, votes, comments, release emails (S-24…S-27)
- [ ] **F9** Builder publish controls (S-11)
- [ ] **F11** rrweb replay module, attach to ticket, default masking

#### M4 · AI & Business (F10, F12)
- [ ] **F10** GitHub App connect (S-13)
- [ ] **F10** Sandboxed auto-PR runner + credits ledger (S-10, S-15)
- [ ] **F10** Never-merge policy + cost caps
- [ ] **F12** SAML / OIDC SSO + force-SSO (S-16)
- [ ] **F12** Audit log + export
- [ ] **F12** Docker / Helm self-host + license activation (S-17)

#### M5 · Beta publik
- [ ] MoR billing (Indie / Studio / Business) + entitlements
- [ ] Annual pricing, early-access Indie 3 months
- [ ] Quota soft-block when over plan
- [ ] Open waitlist → paid; target 10 paying builders / 90 days

### Open questions (from PRD)

- [ ] Nama final dan domain
- [ ] Lemon Squeezy atau Paddle?
- [ ] Basis repo: fork pola Bear Budget Go vs clean (current: new Closeloop repo)
- [ ] Siapa 5–10 builder interview?
- [ ] Jam / minggu kapasitas

---

## Milestone progress (rough)

| Milestone | Focus | Status |
| --- | --- | --- |
| M0 | Landing + waitlist + interviews | Design landing done; waitlist/interviews todo |
| M1 | F1 F2 F4 F5 F6 | Backend core WIP; UI design done; wire + widget polish next |
| M2 | F3 F7 mobile | Todo |
| M3 | F8 F9 F11 | Design only |
| M4 | F10 F12 | Design only |
| M5 | Billing + public beta | Todo |

---

## Suggested next sprint (M1 wire-up)

1. Reconnect **S-03 → S-06 → S-07 → S-08 → S-09** to live APIs (keep pixel UI).
2. Ship production **widget** (S-18…S-21) against ingest API + masking.
3. Finish **F6** email (Resend) + in-app banner.
4. Harden **MCP** install path for Cursor / Claude Code on Bear Budget.
5. Start **M0** waitlist + 5 builder interviews in parallel.

---

## User story checklist (44)

| Status | Stories |
| --- | --- |
| Partial / design | US-01…US-04, US-06…US-11, US-15…US-26, US-32…US-38, US-41…US-44 |
| Not started | US-05 (team API), US-12…US-14, US-27…US-31, US-39…US-40 |

Detail mapping stays in [Closeloop User Stories dan Screens](./Closeloop%20User%20Stories%20dan%20Screens.md).

---

*Update this board when a feature moves from Design → Done (wired) or a PRD checkbox lands.*
