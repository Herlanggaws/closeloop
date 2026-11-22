# Saidloop Kanban

Nov 19, 2026 (audited against code on `dev` @ `746656d`) · Status against [PRD Closeloop MVP](./PRD%20Closeloop%20MVP.md), [PRD Multi-repo per Project](./PRD%20Multi-repo%20per%20Project.md), [PRD Update Pricing dan Batas Fitur](./PRD%20Update%20Pricing%20dan%20Batas%20Fitur.md), [User Stories & Screens](./Closeloop%20User%20Stories%20dan%20Screens.md), and [Tech Plan](./Tech%20Plan%20Closeloop%20MVP.md).

Legend: **Done** = shipped and usable · **Wired** = screen built from `closeloop.pen` and connected to the API · **Partial** = some of it wired · **UI only** = screen exists, nothing behind it · **Todo** = not started.

Design source: `closeloop.pen`, read via Pencil MCP. **Code work to match the Nov 19 design update: see [Brief penyesuaian kode ke desain](#brief-penyesuaian-kode-ke-desain).** Frame node IDs per screen: [User Stories & Screens → Referensi desain](./Closeloop%20User%20Stories%20dan%20Screens.md#referensi-desain-closelooppen).

---

## Board

### Done

| ID | Item | Notes |
| --- | --- | --- |
| DES | Design system foundations | Tokens + `/design-system` review page |
| DES | S-01…S-28 screens | Built from pen → routes under `/app/*`, `/board/*`, `/preview/*` |
| DES | S-30 coach-mark tours | First-visit tours per feature (`components/coach/Tour.tsx`, `CoachMark.tsx`) |
| DES | Landing (S-01) | Pixel match, waitlist CTAs open S-28 modal |
| F1 | Email register / login (S-02) | JWT session; Google OAuth live |
| F1 | Create project API | `POST /api/projects`, public key issued, project cap by plan |
| F1 | MCP token create / list / revoke | Shown once; hashed storage |
| F2 | Ingest API | `POST /v1/ingest/reports`, upload, complete, identify, updates |
| F2 | Web widget package | `frontend/packages/widget` (Preact), "Powered by Saidloop" footer |
| F4 | Tickets API | List, get, patch status, notes, merge |
| F5 | MCP tools | `list_open_feedback`, `get_feedback_context`, `update_status`, `add_note`, `mark_fixed` |
| F6 | mark_fixed → notify path | Worker emails S-23 via Resend (or `.mail` log); in-app banner wired |
| TECH | Monorepo skeleton | Go API + Next frontend + `widget` / `emails` / `js-sdk` packages |
| TECH | Preview index | `/preview` lists all design screens |
| TECH | Report test automation | `pnpm test:reports` / `:ui` / `:all`; CI `report-tests.yml`. Last UI run Nov 17: 5/5 pass ([Report UI Issues](./Report%20UI%20Issues.md)) |
| OPS | GitHub App production guide | [GitHub App Production Setup](./GitHub%20App%20Production%20Setup.md) |

### Screens (UI + wiring status)

| Screen | Route | Status |
| --- | --- | --- |
| S-03 Create project | `/app/onboarding` | **Wired** name + platforms → POST /api/projects → install |
| S-04 Install widget | `/app/onboarding/install` | **Wired** public key + snippet + demo + first-report poll. npm tab hidden until the package is publishable |
| S-04b Install status | `/app/install` | **Wired** two-column guide, snippet, first-report, demo link. Tabs per project platform; mobile projects also get Flutter and React Native tabs (Nov 20), and every SDK snippet passes the API host. Snippets point at packages that are not published yet |
| S-05 Connect MCP | `/app/onboarding/mcp` | **Wired** token + scopes + Cursor/Claude copy + test connection. Footer "Every plan includes all MCP tools, mark_fixed too." (D-01) |
| S-05b MCP status | `/app/mcp` | **Wired** status, multi-client install, token list, revoke, generate |
| S-06 Inbox (+ empty) | `/app/inbox`, `/app/inbox/empty` | **Wired** list + type/status/platform filters + empty + test report; multi-select → S-08. Empty checklist 5 steps by plan (D-02). Repo filter + column (D-15) |
| S-07 Report detail | `/app/tickets/[id]` | **Wired** screenshot, context, status, Reporters panel (name/email/platform), notes, activity oldest → newest, Sentry/PostHog links, header: issue button by plan + Run auto PR + Mark fixed (D-03). Repo property + reroute picker + "No repo yet" (D-16) |
| S-08 Merge duplicates | `/app/inbox/merge` | **Wired** pick parent + merge API |
| S-09 Mark fixed + notify | `/app/tickets/[id]/fixed` | **Wired** release note + preview + Email/In-app toggles. No cross-platform warning yet (US-55) |
| S-10 Auto PR runs | `/app/auto-pr` | **Wired** runs list + credits + single GitHub repo panel. Runner is a stub (opens a context PR) |
| S-11 Manage public board | `/app/board` | **Wired** slug + publish + vote counts + comment moderation + roadmap DnD |
| S-12 Project settings | `/app/settings` | **Partial** name, platforms, notify kill switches, public key, mask text inputs, soft-delete live. Widget section live (Nov 20): button label + position (Bottom right / Bottom left / Hidden) on every plan, accent colour on Studio (`PATCH /api/projects/:id/widget`, migration `024`). Board custom domain still "Coming soon" |
| S-13 Integrations | `/app/settings/integrations` | **Wired** Sentry, PostHog, Slack, Webhooks, GitHub App, GitHub Issues, Linear/Jira. Plan badges + `Upgrade to Indie/Studio` on locked cards, backend `PREMIUM_REQUIRED`, old connections grandfathered (D-04, D-08). Repositories section live (D-12) |
| S-14 Team & roles | `/app/settings/team` | **Wired** invite/accept/resend/revoke + role change; seat caps by plan (`SEAT_LIMIT`) |
| S-15 Billing & credits | `/app/settings/billing` | **Partial** plan + usage (Reports, Projects, Auto PR credits, Seats, Repos) + credit balance. Change plan: Free/Indie/Studio cards with limit line from `lib/plans.ts` (D-05). Plan change is manual (`PATCH /api/org/plan`, Business rejected until M6); "Manual until Subscribed" pill hides once `usage.subscribed` is true. Buy credits is a stub. No invoices list yet |
| S-16 SSO & audit | `/app/settings/sso` | **Partial** audit log list/export wired (Business only, `PLAN_REQUIRED`); SSO SAML/OIDC is UI only. **Hidden until M6** (D-22) |
| S-17 Self-host license | `/app/settings/self-host` | **UI only** route redirects to inbox; stays hidden until M6 |
| S-18…S-20 Widget UX | `/preview/widget/*` + widget package | **Wired** launcher, annotate, Retake, Report #, `Saidloop.show()`, CDN-ready snippet |
| S-21 Fixed banner | `/preview/widget/fixed` + widget package | **Wired** ingest updates → banner; identify refetch |
| S-22 Mobile report sheet | `/preview/widget/mobile` + Android/iOS SDK | **Done** native sheet, offline state and drawing on the screenshot on Android and iOS |
| S-23 / S-27 Emails | `/preview/email/*` | **Wired** S-23 fixed, waitlist confirmation, S-27 vote verify + released-to-voters |
| S-24…S-26 Public board | `/board/[slug]` | **Wired** list/detail/roadmap + votes/comments + suggest an idea |
| S-28 Join Waitlist | `/` modal + `/preview/waitlist` | **Wired** enter / invalid / joined / already + resend; `?join=1` |
| S-30 Coach marks | in-app | **Done** F1…F12 tours |

---

## Todo by milestone

#### M0 · Validasi
- [x] Landing waitlist capture (email → Postgres + confirmation email), hero + footer forms
- [x] S-28 Join Waitlist modal
- [ ] Interview 5–10 builders; log “mau coba minggu ini”
- [x] Final name: Saidloop (domain TBD)
- [x] MoR: [Polar](https://polar.sh/) (billing still manual `plan` until M5)

#### M1 · Inti web (F1, F2, F4, F5, F6)
- [x] **F1** Google OAuth
- [x] **F1** Create project (S-03) + install (S-04) + `/demo.html` widget host
- [x] **F1** Log out (revoke refresh + clear session)
- [x] **F1** Multi-project UI + project limit by plan
- [x] **F1** MCP token list / revoke / generate UI (`/app/mcp`)
- [x] **F1** Team invite + roles (US-05)
- [x] **F2** Widget: shadow DOM launcher, auto screenshot, masking, confirm (S-18…S-20)
- [x] **F2** Sensitive selectors + mask all text inputs applied before capture
- [x] **F4** Inbox wired (list, type/status/platform filters, empty, test report)
- [x] **F4** Report detail (S-07) + mark fixed (S-09) wired
- [x] **F4** Merge duplicates (S-08)
- [x] **F4** Sentry / PostHog deep links
- [x] **F5** Connect MCP (S-05) wired
- [x] **F5** ~~Free-plan read-only MCP~~ superseded by Pricing update P1: Free gets all tools (D-07, migration `021_free_mcp_write.sql`)
- [x] **F6** Resend email on fixed (S-23)
- [x] **F6** In-app fixed banner (S-21)
- [x] **F6** Per-project notify kill switches (S-12)
- [x] **F6** Mark-fixed Email / In-app channel toggles (S-09)
- [x] Dogfood: Bear Budget Web loop verified via demo host and R-UI-01

#### M2 · Mobile (F3, F7) + Multi-repo routing
- [x] **F3** Android Kotlin SDK (shake / `show()`, offline queue, masking) — `project/sdks/android` (Nov 20). Dites di emulator API 33: lapor online + offline queue terkirim otomatis, view `closeloopMask` ketutup di screenshot. Belum: publish ke Maven Central, coret-coret di screenshot, shake belum dites di HP asli (logika shake dites unit)
- [x] **F3** iOS Swift Package — `project/sdks/ios` (Nov 20). Dites di Simulator iPhone 16 (iOS 18.4): lapor masuk ke API lokal, screenshot keupload dengan view `closeloopMask` ketutup, context `screen_name` benar; core 8/8 unit test. Belum: offline belum dites di Simulator (queue dites unit), coret-coret di screenshot, repo rilis SPM terpisah
- [ ] **F3** Dogfood on Bear Budget KMP
- [x] **F7** Flutter package — `project/sdks/flutter` (Nov 20). Dites di emulator Android dan Simulator iOS: lapor masuk, `SaidloopMask` ketutup di screenshot. 4/4 test Dart. Belum: publish ke pub.dev (butuh SDK native ke Maven Central/CocoaPods dulu)
- [x] **F7** React Native + Expo config plugin — `project/sdks/react-native` (Nov 20). Dites di emulator Android dan Simulator iOS (RN 0.76): lapor + mask + antrean offline jalan; plugin Expo dites lewat `expo prebuild` (minSdk 24, gak nurunin target iOS); JS 7/7. Belum: publish ke npm
- [ ] **Multi-repo** see section below (R1–R3 ship with M2)

#### M3 · Tool tim & publik (F8, F9, F11)
- [x] **F8** Slack via Incoming Webhook: new report, status, event filters
- [x] **F8** Slack OAuth channel picker — "Add to Slack" (scope `incoming-webhook`, Slack's own channel picker), keeps events, paste URL still works. Needs `SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET` from a real Slack app before it shows
- [x] **F8** Outbound Webhooks (HTTPS + HMAC)
- [x] **F8** GitHub Issues one-way create from ticket (via GitHub App)
- [x] **F8** Linear / Jira create (API key) + inbound webhook status → fixed
- [x] **F9** Public board: publish controls, ideas list, email-verified votes, comments + replies + moderation, roadmap DnD, live vote counts, voter release emails + kill switch, suggest an idea
- [x] **F11** rrweb replay, attach to ticket, default masking; gated Studio 7d / Business 30d (`ReplayAllowed`)

#### M4 · AI (F10)
- [x] **F10** GitHub App connect (S-13)
- [x] **F10** Stub runner + credits ledger + never-merge policy + flat cost (S-10, S-15). Starter credits: Free 0, paid 10
- [ ] **F10** Real agent runner (Agent SDK / Fly sandbox)

#### M5 · Beta publik
- [ ] Polar billing (Indie / Studio) + set `usage.subscribed` from Polar
  - [x] Checkout + customer portal (`POST /api/billing/checkout`, `/portal`), toggle Monthly/Yearly di Billing, switch manual ke plan berbayar ketutup begitu `POLAR_ACCESS_TOKEN` diisi (22 Nov)
  - [x] Webhook `POST /api/webhooks/billing` → plan org + `usage.subscribed` (migrasi `026_billing_subscriptions.sql`, 22 Nov)
- [ ] Polar credit packs (buy credits is a stub)
- [ ] Annual pricing, early-access Indie 3 months
- [x] Quota soft-block when over plan
- [x] Pricing update P1 + P2 gating (D-07, D-08, D-09). Seat Indie = 2 (D-21, diubah 22 Nov) dan badge cuma di Free (D-20) done
- [ ] Open waitlist → paid; target 10 paying builders / 90 days

#### M6 · Business (F12)

> **Plan Business disembunyikan sampai M6.** Selama itu, user hanya melihat Free, Indie dan Studio. Kode Business yang sudah ada (audit log, gating `business`) tetap di repo, tapi tidak boleh terlihat atau bisa dipilih. Task penyembunyian: **D-22** di [brief](./Brief%20Penyesuaian%20Kode%20ke%20Desain.md).
- [x] **D-22** Sembunyikan plan Business dari semua UI (landing, Billing, sidebar, FAQ, JSON-LD, copy upsell). Flag `BUSINESS_PLAN_VISIBLE` di `frontend/src/lib/plans.ts`
- [ ] **F12** SAML / OIDC SSO + force-SSO (S-16)
- [x] **F12** Audit log + export — sudah dibangun, disembunyikan sampai M6 bersama S-16
- [ ] **F12** Docker / Helm self-host + license activation (S-17)
- [x] Session replay 30 hari (retensi Business; Studio 7 hari tetap jalan) — udah ada: `ReplayRetentionDays` + purge di worker, dites `TestR_REPLAY_03`
- [ ] Kuota laporan sesuai kontrak + harga mulai $149
- [ ] Billing Business (kontrak / invoice tahunan, lisensi self-host)
- [ ] Tampilkan lagi plan Business di landing, Billing, sidebar (balikkan D-22)

---

## PRD Update Pricing dan Batas Fitur (Nov 19)

Updated Nov 19 after D-01…D-09, D-22. Indie seats (D-21) and the badge (D-20) are done. Only Polar (`usage.subscribed`, D-10) are left.

| ID | Item | Status | Story |
| --- | --- | --- | --- |
| P1 | Free gets all MCP tools | **Done** token always `read`+`write`, `mcp.go` checks scope only | US-60 |
| P1 | Migrate active Free tokens to `read`+`write`, log in audit + changelog | **Done** `021_free_mcp_write.sql`, one `mcp.token.scope_upgraded` audit row per org | US-61 |
| P1 | Notify reporters on Free | **Done** MCP `mark_fixed` works on Free | US-62 |
| P1 | `QUOTA_LOCKED` error with reset date + upgrade link on MCP | **Done** MCP + `GET /api/tickets/:id` return `QUOTA_LOCKED` with `reset_at`, `upgrade_url` | US-63 |
| P2 | Slack + GitHub Issues require Indie (`PREMIUM_REQUIRED`), S-13 Indie label + Upgrade | **Done** connect + create-issue gated; connections that existed before the gate are grandfathered (`022_integration_grandfathered.sql`) | US-64 |
| P2 | Linear + Jira require Studio | **Done** same mechanism | US-69 |
| P2 | Public board requires Indie | **Done** publishing an idea (`is_public: true`) needs Indie; unpublish always allowed; already-public ideas stay | US-69 |
| P2 | Badge "Powered by Saidloop" only on Free | **Done** Nov 19 (D-20), Herlangga approved | US-65, US-66 |
| P2 | `MaxReposPerProject` (3 / 5 / 10 / ∞) | **Done** `entitlements.go` + `usage.repos` via `/api/me?project_id=` (counts `project_repos`, D-11) | US-68 |
| P3 | Indie seats: `MaxSeats: 3` → 1 → 2 | **Done** Nov 22: 2 seats and $15 (competitor check). Was 1 seat from Nov 19 (D-21). Existing members keep access; new invites get `SEAT_LIMIT` and the S-14 v2 banner | US-67 |
| UI | Billing Change plan cards with limit line | **Done** (D-05) | US-68 |
| UI | Landing pricing cards | **Done** (D-06), 3 cards until M6 | US-68 |
| UI | Remove "read-only / mark_fixed needs Indie" copy | **Done** (D-01, D-02) | US-60 |
| TEST | Entitlement test per plan for every feature on a plan card | **Done** `TestIntegrationAndBoardGatingPerPlan` + `TestPlan_*` HTTP tests | US-69 |

## PRD Multi-repo per Project (Nov 19) — merged to dev Nov 20

R1–R5 merged to dev on Nov 20 (migration `023_project_repos.sql`; old `repo_full_name` becomes the fallback repo). Not done yet: the runner never actually returns `needs_reroute` (it is still the stub that opens a context PR). Connecting the GitHub App no longer picks one repo: a single-repo install is added for you, otherwise the Add repository modal opens (Nov 20).

| ID | Item | Milestone | Story |
| --- | --- | --- | --- |
| R1 | `project_repos` + `project_repo_routes` tables, migrate existing `repo_full_name` as fallback | M2 | US-45…US-47 |
| R1 | S-13 repo list: platform + path per repo, fallback flag, "x of y repos", disabled add at limit | M2 | US-45…US-48 |
| R1 | Downgrade over limit: pick active repos, freeze routing for the rest | M2 | US-48 |
| R2 | Route new tickets by platform → `tickets.repo_id` / `repo_path`; `ticket_routed` event | M2 | US-49 |
| R2 | Inbox Repo filter + "No repo yet" | M2 | US-50 |
| R2 | Change ticket repo in S-07, log in history, `ticket_rerouted` | M2 | US-51 |
| R3 | `list_open_feedback(repo)`, `get_feedback_context` returns repo/path/platform | M2 | US-52, US-53 |
| R3 | `reroute_feedback(ticket_id, repo, reason)` MCP tool | M2 | US-54 |
| R3 | S-05 guide: fill `repo` from `git remote get-url origin` | M2 | US-52 |
| X | Cross-platform warning on mark fixed (MCP `confirm: true` + S-09 block with reporters per platform) | M2 | US-55 |
| R5 | GitHub Issues created in the ticket's repo | M3 | US-59 |
| R4 | Auto PR uses ticket repo; `needs_reroute` + `suggested_repo` + credit refund; "Run in suggested repo" in S-10 | M4 | US-56, US-57 |
| R4 | Opt-in read access to other repos in the project | M4 | US-58 |

## Design in `closeloop.pen` (re-audit Nov 19)

Every story in both new PRDs now has a design: v2 frames, S-31 badge, and the coverage map in frame `SimGS`. Node IDs per story: [User Stories & Screens → Referensi desain](./Closeloop%20User%20Stories%20dan%20Screens.md#referensi-desain-closelooppen). Score 8.5/10 (was 6/10).

Fixed since the first audit: Saidloop copy on landing, waitlist, widget, emails and snippets; Free "full MCP loop" copy on S-01, S-05 and S-06 empty; Linear/Jira labelled Studio; S-15 Change plan with the limit line, seats and repos; S-09 cross-platform warning; S-13 repo list; S-06 repo filter; S-07 repo + reroute; S-10 `needs_reroute`; S-07 timeline order; S-06 empty Free gating.

Still open:
- [x] Coach mark F5 footer now "Every plan includes all MCP tools, mark_fixed too." (fixed in pen Nov 20)
- [x] S-14 v2 switcher now "Pixel Studio · Indie"; S-14 Studio quota already 312 / 10,000 (fixed Nov 20)
- [x] S-10 v2 Needs reroute row PR now `—` (fixed Nov 20)
- [x] S-09 v2 banner card now "2 reporters on Web" (fixed Nov 20)
- [x] GitHub Issues card now "Create issues from tickets" in every S-13 frame (fixed Nov 20)
- [ ] Domain mix: `saidloop.com` (MCP, badge link) vs `saidloop.dev` (email sender). Settle once the domain is decided
- [x] S-15 Change plan: Studio "· 5 seats", Business "· Unlimited seats" in pen and `lib/plans.ts` (fixed Nov 20)

## Brief penyesuaian kode ke desain

**Agent: baca [Brief Penyesuaian Kode ke Desain](./Brief%20Penyesuaian%20Kode%20ke%20Desain.md) sebelum mengerjakan item di bawah.** Tiap ID (D-xx) punya frame + node ID, file yang diubah, copy persis, perubahan backend, kriteria selesai, dan bagian desain yang harus diabaikan. Centang di sini setelah selesai.

Fase A · samakan screen yang sudah ada (frontend saja)
- [x] D-01 S-05 Connect MCP: hapus copy read-only, footer "Every plan includes all MCP tools" (`HcHA7`)
- [x] D-02 S-06 Inbox empty: checklist sesuai plan (`PN6mj`)
- [x] D-03 S-07 Report detail: panel Reporters, tombol issue per plan, timeline lama → baru (`mxSU2`)
- [x] D-04 S-13 Integrations: Linear dan Jira berlabel Studio (`wAub0`)
- [x] D-05 S-15 Billing: Change plan dengan baris limit, usage Seats + Repos (`jRMCb`)
- [x] D-06 S-01 Landing pricing: isi kartu baru (`BPPVw`)
- [x] D-22 Sembunyikan plan Business sampai M6 (landing, Billing, sidebar SSO, FAQ, JSON-LD, copy upsell)

Fase B · pricing di backend
- [x] D-07 Free dapat semua tools MCP + migrasi token + `QUOTA_LOCKED` (US-60, US-61, US-63)
- [x] D-08 Gating Slack / GitHub Issues → Indie, Linear / Jira → Studio, board → Indie + UI `dmcSk` (US-64, US-69)
- [x] D-09 `MaxReposPerProject` + `usage.repos`
- [ ] D-10 `usage.subscribed` dari penyedia pembayaran (bareng M5). Field belum dikirim; Billing sudah siap membacanya

Fase C · multi-repo — udah di-merge ke dev 20 Nov (migrasi `023`). Yang masih kurang: runner auto PR masih stub (gak pernah balikin `needs_reroute` sendiri) Connect GitHub App udah gak maksa pilih 1 repo lagi (20 Nov).
- [x] D-11 Tabel `project_repos` / `project_repo_routes`, kolom tiket, migrasi `repo_full_name`. — `023_project_repos.sql` + migrasi repo lama jadi fallback
- [x] D-12 S-13 v2 Repositories (`ho9Yy`, `dmcSk`). — S-13 Repositories section, counter, limit copy, read-access toggle
- [x] D-13 Add repository modal + `PLATFORM_CONFLICT` (`DMYRO`). — modal Add repository + `PLATFORM_CONFLICT` / `REPO_LIMIT`
- [x] D-14 Downgrade: pilih repo yang tetap routing (`vZyTd`). — modal pilih repo + `POST /repos/active`, repo lain `routing_paused`
- [x] D-15 Routing tiket + filter/kolom Repo di inbox (`z9TjRd`). — routing saat ingest + `ticket_routed`, filter `?repo=` + kolom Repo di inbox
- [x] D-16 S-07 repo, reroute, "No repo yet" (`HMFLR`, `ajZz9`). — properti Repo + picker reroute + "No repo yet" di S-07, issue di repo tiket
- [x] D-17 MCP `repo` param + `reroute_feedback` + panduan S-05 v2 (`G05BeG`). — `list_open_feedback(repo)`, `reroute_feedback`, konteks repo/path/platform, panduan S-05
- [x] D-18 Peringatan lintas platform di mark fixed (`Mixlu`). — peringatan lintas platform di S-09 + MCP `confirm: true`, `notify_platforms[]`
- [x] D-19 Auto PR `needs_reroute` + refund (`aHJCX`). — auto PR pakai repo tiket, `needs_reroute` + refund, kartu Run in <repo> di S-10

Fase D · menunggu keputusan (jangan dikerjakan dulu)
Status Nov 19: D-20 dan D-21 done. D-10 belum (nunggu Polar M5).
- [x] D-20 Badge "Powered by Saidloop" cuma di Free (`s67yG`): `/v1/ingest/config` kirim `badge` + `badge_url` (UTM `utm_source=badge&utm_medium={surface}&utm_campaign={project_id}`), widget tampilkan di launcher (tooltip hover), form, sent, banner, dicek ulang tiap 1 menit; email pelapor/voter/comment/suggest footer `Powered by Saidloop` di Free, hilang di plan berbayar. Diputusin Herlangga 19 Nov
- [x] D-21 Seat Indie = 2 sejak 22 Nov (awalnya 1, detail berikut dari 19 Nov) + S-14 v2 (`APr9x`): subjudul `x of 1 seat used`, banner merah `Invite not sent. Indie includes 1 seat.` + `Upgrade to Studio`, header Members `over the Indie seat limit`. Diputusin Herlangga 19 Nov

---

## Open questions

- [x] Nama final: Saidloop (domain TBD)
- [x] MoR: Polar (https://polar.sh/) — bukan Lemon Squeezy / Paddle
- [ ] Domain final (code and snippets still use `closeloop.dev`)
- [x] Seat Indie: 2, harga $15 (diputusin 22 Nov; sebelumnya 1 seat dan $12)
- [ ] `closeloop.pen` belum ikut: S-01 pricing, S-06 checklist, S-14 v2, S-15 masih $12 / 1 seat
- [x] Badge "Powered by Saidloop" cuma di Free (disetujui 19 Nov)
- [ ] Kuota Free tetap 50?
- [ ] Angka repo per project (3 / 5 / 10) — validate in M0 interviews
- [ ] Basis repo: fork pola Bear Budget Go vs clean (current: new repo)
- [ ] Siapa 5–10 builder interview?
- [ ] Jam / minggu kapasitas

---

## Milestone progress (rough)

| Milestone | Focus | Status |
| --- | --- | --- |
| M0 | Landing + waitlist + interviews | Waitlist + confirmation shipped; interviews todo |
| M1 | F1 F2 F4 F5 F6 | Complete and validated on Bear Budget Web. Free MCP gate reverted (Pricing P1, D-07) |
| M2 | F3 F7 mobile + Multi-repo R1–R3 | Todo |
| M3 | F8 F9 F11 | Done (Slack OAuth needs the Slack app credentials in env). Plan gating for integrations and board shipped (D-08) |
| M4 | F10 | GitHub App + stub runner done; real runner open |
| M5 | Billing + public beta + Pricing update | Todo (manual plans only). Free, Indie, Studio only |
| M6 | F12 Business: SSO, audit log, self-host, replay 30d, contract quota | Audit log built; rest todo. Business plan hidden until here |

---

## Suggested next sprint

1. ~~Fase A brief (D-01 sampai D-06, D-22)~~ done Nov 19.
2. ~~D-07 Pricing P1~~ done Nov 19.
3. ~~D-08, D-09 Pricing P2~~ done Nov 19.
4. Putuskan seat Indie dan badge, lalu D-20 dan D-21.
5. Mulai **M0** interview builder (sekalian validasi batas repo).
6. **M2**: Fase C multi-repo (D-11 sampai D-19) bareng SDK mobile pertama.

---

## User story checklist

| Status | Stories |
| --- | --- |
| Done (wired) | US-01…US-11, US-15…US-26, US-29…US-35, US-37, US-39, US-40 |
| Partial | US-36 (stub runner, no label rules), US-38 (credit balance only, no purchase), US-44 (manual plan change, no Polar) |
| Not started | US-12…US-14, US-27, US-28 (mobile) |
| M6 · Business (hidden until then) | US-41 (SSO), US-43 (self-host) not started; US-42 (audit log) built but hidden |
| Not started (Multi-repo) | US-45…US-59 |
| Not started (Pricing update) | US-60, US-61, US-63, US-64, US-68, US-69. US-62 partial (dashboard path already notifies on Free) |
| Waiting on decision | US-65, US-66 (badge), US-67 (seat Indie) |

Detail mapping stays in [Closeloop User Stories dan Screens](./Closeloop%20User%20Stories%20dan%20Screens.md).

---

*Update this board when a feature moves to Wired / Done or a PRD checkbox lands.*
