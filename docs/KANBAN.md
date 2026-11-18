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
| F1 | Email register / login (S-02) | JWT session; Google OAuth live |
| F1 | Create project API | `POST /api/projects`, public key issued |
| F1 | MCP token create | Shown once; hashed storage |
| F2 | Ingest API | `POST /v1/ingest/reports`, upload, complete, identify, updates |
| F2 | Web widget package | `@closeloop/widget` (Preact) present |
| F4 | Tickets API | List, get, patch status, notes, merge |
| F5 | MCP tools | `list_open_feedback`, `get_feedback_context`, `update_status`, `add_note`, `mark_fixed` |
| F6 | mark_fixed → notify path | Worker emails S-23 HTML via Resend (or `.mail` log); in-app banner wired |
| TECH | Monorepo skeleton | Go API + Next frontend + widget / emails / js-sdk packages |
| TECH | Preview index | `/preview` lists all design screens |

### Design-only (UI done · wire next)

| Screen | Route | Wire to |
| --- | --- | --- |
| S-03 Create project | `/app/onboarding` | **Wired** name + platforms → POST /api/projects → install |
| S-04 Install widget | `/app/onboarding/install` | **Wired** wizard public key + snippet + demo + first-report poll |
| S-04b Install status | `/app/install` | **Wired** app-shell status, snippet, first-report, demo link |
| S-05 Connect MCP | `/app/onboarding/mcp` | **Wired** wizard token + scopes + Cursor/Claude copy + test connection |
| S-05b MCP status | `/app/mcp` | **Wired** app-shell status, multi-client install, token list, revoke, generate |
| S-06 Inbox (+ empty) | `/app/inbox`, `/app/inbox/empty` | **Wired** list + type/status filters + empty + test report; multi-select → S-08 |
| S-07 Report detail | `/app/tickets/[id]` | **Wired** screenshot, context, status, notes, activity; Sentry/PostHog deep links when configured; Auto PR stub |
| S-08 Merge duplicates | `/app/inbox/merge` | **Wired** multi-select → pick parent → merge API |
| S-09 Mark fixed + notify | `/app/tickets/[id]/fixed` | **Wired** release note + preview + PATCH fixed (notify enqueue); channel toggles visual |
| S-10 Auto PR runs | `/app/auto-pr` | Runs list when F10 ships |
| S-11 Manage public board | `/app/board` | **Wired** slug + publish + Ideas vote counts + comment moderation + roadmap DnD columns |
| S-12 Project settings | `/app/settings` | **Partial** general name + platforms + notify + public key + masking + soft-delete (30d purge) live; board domain shell |
| S-13 Integrations | `/app/settings/integrations` | **Partial** pen-aligned catalog; Sentry/PostHog + Slack webhook wired; GitHub/Linear/Jira/App/Webhooks stubs (F8/F10) |
| S-14 Team & roles | `/app/settings/team` | **Wired** S-14 layout (invite chips, merged roster, role cards); invite/accept/resend/revoke + role change; seat caps by plan |
| S-15 Billing & credits | `/app/settings/billing` | **Partial** plan + usage wired; manual plan change until Polar; credits stub |
| S-16 SSO & audit | `/app/settings/sso` | Business (F12) |
| S-17 Self-host license | `/app/settings/self-host` | Business (F12) |
| S-18…S-20 Widget UX | `/preview/widget/*` + `@closeloop/widget` | **Wired** launcher, annotate, Retake, Report #, `Saidloop.show()`, CDN-ready snippet env |
| S-21 Fixed banner | `/preview/widget/fixed` + `@closeloop/widget` | **Wired** ingest updates → S-21 banner; identify refetch |
| S-22 Mobile report sheet | `/preview/widget/mobile` | Needs F3 SDK |
| S-23 / S-27 Emails | `/preview/email/*` | S-23 fixed + waitlist confirmation wired; S-27 vote verify + released-to-voters on mark fixed |
| S-28 Join Waitlist | `/` modal + `/preview/waitlist` | Enter / invalid / joined / already + resend; CTAs open modal (`?join=1`) |
| S-24…S-26 Public board | `/board/[slug]` | **Wired** list/detail/roadmap + votes/comments; builder roadmap DnD on `/app/board` |

### Todo — by PRD feature

#### M0 · Validasi
- [x] Landing waitlist capture (email → Postgres + confirmation HTML via Resend/`.mail`), hero + footer forms
- [x] S-28 Join Waitlist modal (enter / invalid / joined / already + resend)
- [ ] Interview 5–10 builders; log “mau coba minggu ini”
- [x] Final name: Saidloop (domain TBD)
- [x] MoR: [Polar](https://polar.sh/) (billing still manual `plan` until M5)

#### M1 · Inti web (F1, F2, F4, F5, F6) — priority

> Live app surface: M1 + M3 Slack + public board list/detail. Auto PR (`/app/auto-pr`), SSO, self-host, and Auto PR credits stay **hidden** (nav stripped + routes redirect to inbox). Design screens remain under `/preview`.
- [x] **F1** Google OAuth
- [x] **F1** Wire create project (S-03) + install (S-04) + `/demo.html` widget host
- [x] **F1** Log out (revoke refresh + clear session)
- [x] **F1** Multi-project UI + plan limits
- [x] **F1** MCP token list / revoke / generate UI (`/app/mcp`)
- [x] **F1** Team invite + roles (US-05) — API + S-14
- [x] **F2** Widget: shadow DOM launcher, auto screenshot, masking, confirm (S-18…S-20) on CDN
- [x] **F2** Sensitive selectors from project settings applied before capture
- [x] **F4** Wire inbox to API (list, type/status filters, empty, test report) — detail still design
- [x] **F4** Wire report detail (S-07) + mark fixed (S-09) to API
- [x] **F4** Wire merge duplicates (S-08) — pick parent + POST merge; activity event
- [x] **F4** Platform filter on inbox list (`?platform=` + Platform dropdown)
- [x] **F4** Sentry / PostHog deep links when integration present
- [x] **F5** Wire Connect MCP (S-05) — token, Cursor/Claude install copy, test connection
- [x] **F5** Free-plan read-only MCP (create scopes + write tools gated; UI badge)
- [x] **F6** Resend email on fixed (S-23 template)
- [x] **F6** In-app fixed banner via ingest updates (S-21)
- [x] **F6** Per-project notify kill switch (S-12)
- [x] Dogfood: Bear Budget Web feedback loop verified via demo host & R-UI-01 smoke

#### M2 · Mobile (F3, F7)
- [ ] **F3** Android Kotlin SDK (shake / `show()`, offline queue, masking)
- [ ] **F3** iOS Swift Package
- [ ] **F3** Dogfood on Bear Budget KMP
- [ ] **F7** Flutter package (pub.dev)
- [ ] **F7** React Native + Expo config plugin

#### M3 · Tool tim & publik (F8, F9, F11)
- [x] **F8** Slack new-report via Incoming Webhook (Settings → Integrations)
- [x] **F8** Slack status notifications (same webhook; OAuth channel picker later)
- [x] **F8** Slack event filters (new bug / idea / status / marked fixed)
- [ ] **F8** Slack OAuth channel picker
- [ ] **F8** GitHub Issues / Linear / Jira create + bi-directional status
- [x] **F9** Builder publish controls + public ideas list (`/app/board`, `/board/[slug]`)
- [x] **F9** Email-verified votes on public board (S-27 verify)
- [x] **F9** Release emails to voters on mark fixed (S-27 released)
- [x] **F9** Board comments + one-level replies + moderation hide
- [x] **F9** Roadmap moderation DnD on `/app/board` (Planned / In progress / Released)
- [x] **F9** Ideas tab live `vote_count` from confirmed votes (R-UI-15)
- [ ] **F11** rrweb replay module, attach to ticket, default masking

#### M4 · AI & Business (F10, F12)
- [ ] **F10** GitHub App connect (S-13)
- [ ] **F10** Sandboxed auto-PR runner + credits ledger (S-10, S-15)
- [ ] **F10** Never-merge policy + cost caps
- [ ] **F12** SAML / OIDC SSO + force-SSO (S-16)
- [ ] **F12** Audit log + export
- [ ] **F12** Docker / Helm self-host + license activation (S-17)

#### M5 · Beta publik
- [ ] Polar billing (Indie / Studio / Business) + entitlements
- [ ] Annual pricing, early-access Indie 3 months
- [x] Quota soft-block when over plan (shipped with M1 F1; Polar checkout still M5)
- [ ] Open waitlist → paid; target 10 paying builders / 90 days

### Open questions (from PRD)

- [x] Nama final: Saidloop (domain TBD)
- [x] MoR: Polar (https://polar.sh/) — bukan Lemon Squeezy / Paddle
- [ ] Basis repo: fork pola Bear Budget Go vs clean (current: new Closeloop repo)
- [ ] Siapa 5–10 builder interview?
- [ ] Jam / minggu kapasitas

---

## Milestone progress (rough)

| Milestone | Focus | Status |
| --- | --- | --- |
| M0 | Landing + waitlist + interviews | Waitlist + confirmation email shipped; interviews todo |
| M1 | F1 F2 F4 F5 F6 | Complete & validated on Bear Budget Web |
| M2 | F3 F7 mobile | Todo |
| M3 | F8 F9 F11 | Slack + public board + votes/comments + roadmap DnD; OAuth/replay still open |
| M4 | F10 F12 | Design only |
| M5 | Billing + public beta | Todo |

---

## Suggested next sprint (M1 wire-up)

1. ~~Onboarding **S-03 → S-05** + inbox **S-06 → S-09** wired.~~
2. ~~Ship production **widget** (S-18…S-20) + CDN-ready snippets.~~
3. ~~Finish **F6** email (Resend) + in-app banner.~~
4. ~~Dogfood Closeloop on Bear Budget (MCP status page shipped, R-UI-01 verified).~~
5. Start **M0** waitlist + 5 builder interviews in parallel.
6. ~~**Report test automation** Phase A–D~~ — local `pnpm test:reports` / `:ui` / `:all`; CI `.github/workflows/report-tests.yml` (Go on PR, UI nightly). Issue list: [Report UI Issues](./Report%20UI%20Issues.md). See [AI Report Testing Plan](./AI%20Report%20Testing%20Plan.md).
7. ~~**F1** Team invite + roles (US-05 / S-14).~~

---

## User story checklist (44)

| Status | Stories |
| --- | --- |
| Partial / design | US-01…US-04, US-06…US-11, US-15…US-26, US-32…US-38, US-41…US-44 |
| Not started | US-12…US-14, US-27…US-31, US-39…US-40 |

Detail mapping stays in [Closeloop User Stories dan Screens](./Closeloop%20User%20Stories%20dan%20Screens.md).

---

*Update this board when a feature moves from Design → Done (wired) or a PRD checkbox lands.*
