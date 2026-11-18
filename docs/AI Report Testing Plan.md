# AI Report Testing Plan

Nov 17, 2026 · Scope: **report loop only** (ingest → inbox → detail → merge → mark fixed → notify).  
Goal: AI menjalankan test case secara berulang; manusia hanya baca report. Bug yang ketemu → **auto-fix** di loop yang sama.

Referensi: [KANBAN](./KANBAN.md), [PRD](./PRD%20Closeloop%20MVP.md) SC-2 / SC-4, [User Stories](./Closeloop%20User%20Stories%20dan%20Screens.md) US-06…US-11, US-15…US-16, US-21…US-25.

---

## 1. Prinsip

| Prinsip | Artinya |
| --- | --- |
| Report-only | Tidak test billing, SSO, public board, mobile SDK, auto-PR. Hanya jalur laporan. |
| AI-first | Test case ditulis supaya agent Cursor/Claude bisa jalanin tanpa langkah manual. |
| Automate once | Setelah suite hijau, re-run = `pnpm test:reports` (atau agent skill), bukan klik ulang UI. |
| Fail → fix → re-run | Gagal = bug ticket internal + patch di repo + commit di `dev` + re-run suite sampai hijau atau escalate. |
| Deterministic | Seed data tetap; assert via API/DB dulu, browser hanya untuk path yang API tidak cover. |
| No flake | Timeout eksplisit, poll dengan backoff, tidak bergantung screenshot pixel-perfect kecuali masking. |

---

## 2. Scope yang diuji (dari yang sudah wired)

```text
Widget / demo / test-report button
        │  public key
        ▼
POST /v1/ingest/reports  →  upload  →  complete  →  ticket + report
        │
        ▼
Inbox S-06  →  Detail S-07  →  Merge S-08  →  Mark fixed S-09
        │                              │
        │                              ▼
        │                     worker email (S-23) + GET /v1/ingest/updates (S-21)
        ▼
MCP: list_open_feedback → get_feedback_context → mark_fixed / update_status / add_note
```

**In scope**

- Ingest: create, complete, identify, updates, config (sensitive selectors)
- Dashboard: list/filter tickets, detail, notes, status, merge, mark fixed + notify enqueue
- Widget path: demo host / Send test report → muncul di inbox
- MCP tools di atas (write tools gated by plan/scopes)
- Notify kill switch (`notify_enabled`) dan soft effects (no email when off)

**Out of scope (fase ini)**

- Google OAuth UI, settings rename (kecuali selectors & notify)
- Sentry/PostHog deep links, rrweb, Slack/Linear, F10 auto-PR
- Pixel match vs `closeloop.pen`

**Related (bukan report loop):** waitlist — `W-01` / `W-02` / `W-03` in `waitlist_test.go` (send once on insert + `inserted`/`created_at`; invalid email no send; resend for existing email). Board votes/comments: HTML in `vote_test.go` / `comment_test.go`; wire `R-BOARD-05`…`09` + `R-UI-11`/`12`.

---

## 3. Lapisan automation

| Layer | Tool | Apa yang di-cover | Kapan jalan |
| --- | --- | --- | --- |
| L0 Contract | Go `httptest` + seed helpers | Auth surface, status codes, error shape `{error:{code,message}}` | Setiap commit / agent loop |
| L1 API E2E | Bash/Go test + `scripts/seed.sh` style | Full report lifecycle di HTTP | Setiap commit |
| L2 MCP E2E | JSON-RPC ke `/mcp` | Agent tooling path SC-2 steps 5–6 | Setiap commit |
| L3 UI smoke | Playwright (Chromium) | Inbox list, filters, merge, mark-fixed form, demo widget submit | Nightly + sebelum push besar |
| L4 Notify | Worker + mail sink (`.mail` / mock) | S-23 render + enqueue; updates → banner payload | Setiap commit |

Target folder (implementasi berikutnya, bukan sekarang):

```text
project/
  backend/internal/.../*_test.go          # L0 / L1 / L4
  scripts/test-reports.sh                 # orchestrator satu perintah
  frontend/e2e/reports.spec.ts            # L3 Playwright
  docs/AI Report Testing Plan.md          # dokumen ini
  docs/reports/                           # output run (AI tulis di sini)
    latest.md
    YYYY-MM-DD-HHMM.md
```

Satu perintah untuk manusia / AI:

```bash
cd project && bash scripts/test-reports.sh
# exit 0 = hijau; exit 1 = ada failing case + path ke report MD
```

---

## 4. Test cases (AI-runnable)

Format ID: `R-<area>-<nn>`. Tiap case punya **Given / When / Then**, **assert API**, dan **fix hint** supaya agent tahu file mana yang disentuh dulu.

### 4.1 Ingest (F2)

| ID | Case | Given | When | Then | Fix hint |
| --- | --- | --- | --- | --- | --- |
| R-ING-01 | Create bug report | Valid `X-Closeloop-Key` | `POST /v1/ingest/reports` type=bug + message | 201; `report_id` + upload URL; ticket status `open` | `ingestReport`, store create report/ticket |
| R-ING-02 | Reject bad key | Key revoked / unknown | POST reports | 401/403; no row | key lookup middleware |
| R-ING-03 | Types | — | type bug / idea / question | Accepted; ticket.type match | validation |
| R-ING-04 | Complete upload | Report created | PUT upload + `POST .../complete` | attachments ready; inbox shows report | completeReport + storage |
| R-ING-05 | Identify | Public key | `POST /v1/ingest/identify` user_id + email | Reporter upserted; later reports link | identify handler |
| R-ING-06 | Config selectors | Project has `sensitive_selectors` | `GET /v1/ingest/config` | Selectors returned for widget | ingestConfig |
| R-ING-07 | Context JSON | context.url / browser set | Create report | Stored in report.context; detail API returns it | JSONB round-trip |
| R-ING-08 | Platform tag | platform=web | Create | Inbox filter `?platform=web` includes it | listTickets filter |
| R-ING-09 | JSON base64 upload | Report created | PUT upload `Content-Type: application/json` + `{data}` (bare base64; no `image/png` literal) | attachment uploaded (DNSCloud WAF-safe) | decodeAttachmentBody |

### 4.2 Inbox & detail (F4 · S-06 / S-07)

| ID | Case | Given | When | Then | Fix hint |
| --- | --- | --- | --- | --- | --- |
| R-INB-01 | List after ingest | Seed 1 report | `GET /api/projects/:id/tickets` | Count ≥ 1; title/message visible | listTickets |
| R-INB-02 | Filter type+status | Mix bug/idea open/fixed | `?type=bug&status=open` | Only matching | query params |
| R-INB-03 | Empty state | New project no reports | Open inbox API | `[]` (UI empty copy separately in L3) | — |
| R-INB-04 | Detail | Ticket id | `GET /api/tickets/:id` | Screenshot URL, context, activity | getTicket |
| R-INB-05 | Add note | Open ticket | `POST /api/tickets/:id/notes` | Event in activity; note body stored | addNote |
| R-INB-06 | Status patch | Open ticket | PATCH status=`in_progress` | Status + ticket_events | patchTicket |
| R-INB-07 | Test report button | Logged-in session | UI/API path used by Inbox “Send test report” | New open bug appears without widget | Inbox.tsx + ingest |

### 4.3 Merge (F4 · S-08)

| ID | Case | Given | When | Then | Fix hint |
| --- | --- | --- | --- | --- | --- |
| R-MRG-01 | Merge to parent | 3 open tickets same project | `POST /api/tickets/merge` parent + children | Children closed/merged; reports under parent; activity event | mergeTickets |
| R-MRG-02 | Reject cross-project | Tickets beda project | Merge | 4xx; no change | validation |
| R-MRG-03 | Parent stays open | Merge succeeds | GET parent | status open; report_count increased | store merge |

### 4.4 Mark fixed + notify (F6 · S-09 / S-21 / S-23)

| ID | Case | Given | When | Then | Fix hint |
| --- | --- | --- | --- | --- | --- |
| R-FIX-01 | Mark fixed API | Ticket open + reporter email | PATCH status=fixed + note | `fixed_at` set; notify job enqueued | patchTicket + worker |
| R-FIX-02 | MCP mark_fixed | MCP token write scope | tools/call `mark_fixed` | Same as R-FIX-01 | mcp.go |
| R-FIX-03 | Email rendered | Mail sink / `.mail` | Job runs | HTML contains note + ticket ref (S-23) | fixed.go renderer |
| R-FIX-04 | Kill switch | `notify_enabled=false` | mark_fixed | No email; ticket still fixed | worker guard |
| R-FIX-05 | In-app updates | Reporter identified | `GET /v1/ingest/updates?reporter=` | Fixed payload once; second poll empty/seen | ingestUpdates |
| R-FIX-06 | Free plan MCP write | Free plan read-only token | mark_fixed via MCP | Rejected / gated; UI badge path not required in L1 | scope gate |
| R-FIX-07 | Per-action channels | PATCH `notify: {email:false,in_app:true}` | mark fixed | No mail; banner still via updates | EnqueueNotify payload |
| R-FIX-08 | Banner kill switch | `banner_enabled=false` | mark fixed | Email still sent; no in-app updates | NotifyReporters gate |

### 4.4b Slack notify (F8 · S-13)

| ID | Case | Given | When | Then | Fix hint |
| --- | --- | --- | --- | --- | --- |
| R-SLACK-01 | New report webhook | Slack Incoming Webhook saved | Ingest + ProcessJobsOnce | One POST to webhook with title + ticket link | EnqueueSlackNotify + notify_slack job |
| R-SLACK-02 | No Slack config | No slack integration | Ingest + ProcessJobsOnce | No `notify_slack` job / no POST | EnqueueSlackNotify guard |
| R-SLACK-03 | Status change | Slack saved; ticket open | PATCH status=in_progress | POST with from/to | patchTicket → status_changed |
| R-SLACK-04 | Mark fixed note | Slack saved | MCP mark_fixed + note | POST includes fixed + note | mcp mark_fixed enqueue |
| R-HOOK-01 | Outbound created | Webhooks URL + secret | Ingest bug | Signed POST `ticket.created` | EnqueueOutboundWebhook |
| R-HOOK-02 | Event filter + auto secret | events=`ticket.fixed` only | Ingest then mark fixed | Create skipped; fixed posts; secret generated | normalizeOutboundEvents |
| R-HOOK-03 | Reject HTTP URL | `http://…` | PUT webhooks | 400 | UpsertIntegration |
| R-SLACK-05 | Same status no-op | Slack saved; ticket open | PATCH status=open | No slack job/post | from==to guard |

### 4.4c Public board (F9 · S-11 / S-24)

| ID | Case | Given | When | Then | Fix hint |
| --- | --- | --- | --- | --- | --- |
| R-BOARD-01 | Publish appears | Project has `board_slug` | PATCH `is_public=true` + GET public board | Idea listed with title | SetTicketPublic + PublicBoardBySlug |
| R-BOARD-02 | Unpublished / bad slug | Ticket not public / unknown slug | GET public board | Empty list / 404 | is_public filter |
| R-BOARD-03 | No private fields | Published ticket with email/context | GET public board + idea | Payload has no message/context/email/attachments | PublicIdea DTO |
| R-BOARD-04 | Idea detail 404 | Unpublished / wrong slug / unknown id | GET public idea | 404 | PublicIdeaBySlug |
| R-BOARD-05 | Vote confirm | Publish + POST vote | Process job + GET confirm | vote_count=1; reuse 409 | RequestIdeaVote + ConfirmIdeaVote |
| R-BOARD-06 | Vote guards | Unpublished / bad email | POST votes | 404 / 400 | PublicIdeaBySlug + NormalizeVoterEmail |
| R-BOARD-07 | Vote released | Confirmed voter on public idea | Mark fixed + process jobs | VoteReleased mail to voter; skip if private/no votes | EnqueueVoteReleased + notify_vote_released |
| R-BOARD-10 | Voter notify kill switch | `voter_notify_enabled=false` + confirmed vote | Mark fixed | No `notify_vote_released` job/mail | EnqueueVoteReleased gate |
| R-BOARD-08 | Comment confirm + reply | Publish idea | POST comment → confirm → reply + team + hide | Public list/replies; hidden excluded | RequestIdeaComment + SetCommentHidden |
| R-BOARD-09 | Comment guards | Unpublished / bad email / empty / bad parent | POST comments | 404 / 400 | PublicIdeaBySlug + normalize |

### 4.5 MCP read path (F5 · SC-2)

| ID | Case | Given | When | Then | Fix hint |
| --- | --- | --- | --- | --- | --- |
| R-MCP-01 | list_open_feedback | ≥1 open ticket | tools/call | Includes new report; excludes fixed | mcp list |
| R-MCP-02 | get_feedback_context | Ticket id | tools/call | Message, context, attachments meta | mcp get |
| R-MCP-03 | update_status / add_note | Write scope | tools/call | Persisted like dashboard | mcp write |
| R-MCP-04 | Bad MCP token | Garbage bearer | Any call | 401 | auth |

### 4.6 UI smoke (L3 · optional tiap commit, wajib nightly)

| ID | Case | Steps | Then |
| --- | --- | --- | --- |
| R-UI-01 | Demo → inbox | Open `/demo.html?key=…`, submit bug, open `/app/inbox` | Row appears with type Bug |
| R-UI-02 | Filters | Set type Bug + status Open | List matches API |
| R-UI-03 | Merge flow | Multi-select → `/app/inbox/merge` → confirm | Parent detail shows merged count |
| R-UI-04 | Mark fixed UI | Detail → fixed → submit note | Status Fixed; activity updated |
| R-UI-05 | Banner payload | After fix + identify | `/v1/ingest/updates` non-empty (widget banner assert light) |
| R-UI-06 | Post-M1 surface | Inbox nav + `/app/auto-pr` + `/app/board` | Public board link + page live; Auto PR still hidden/redirect |
| R-UI-07 | Public board | Publish idea via API | Open `/board/{slug}` | Published title visible |
| R-UI-08 | Idea detail | Publish idea via API | Open list → click idea | Detail title + back to list |
| R-UI-10 | Integrations catalog | Seed session | Open `/app/settings/integrations` | Notify/Debugging sections + Slack Configure webhook field |
| R-UI-11 | Board vote | Publish idea | Vote modal → confirm token → idea | Voted banner + count path | S-27 verify |
| R-UI-12 | Board comment | Publish idea | Comment composer → confirm token → idea | Comment body visible | S-25 comments |
| R-UI-13 | Roadmap DnD | Publish idea | `/app/board` Roadmap → move to In progress | Card in column; status `in_progress` | S-11 roadmap |
| R-UI-14 | Inbox live refresh | Open inbox | Ingest + `closeloop:submitted` | New row appears without reload | widget event + Inbox refetch |
| R-UI-15 | Ideas vote count | Publish + confirm vote | Open `/app/board` Ideas | Votes column shows 1 | Ticket.vote_count |

---

## 5. Happy-path scenario (satu skrip end-to-end)

Ini mirror **SC-2** yang sudah shipped; jadi golden path automation:

1. Register/login (atau reuse seed `demo@closeloop.dev`).
2. Create project → simpan `public_key`, `project_id`, MCP token (write).
3. Ingest bug report (+ identify reporter).
4. Assert inbox list + detail.
5. MCP `list_open_feedback` → `get_feedback_context`.
6. MCP `mark_fixed` dengan release note.
7. Assert ticket fixed, mail sink has S-23, `updates` returns banner payload.
8. Second `updates` poll → empty.
9. Tulis ringkasan ke `docs/reports/latest.md`.

Kalau step N gagal → stop, masuk **auto-fix loop** (§6), jangan lanjut assert yang bergantung.

---

## 6. AI runbook: test → report → auto-fix

### 6.1 Trigger

Agent dipicu saat:

- User bilang “jalanin report tests” / `/test-reports`
- Pre-push / selesai fitur report-related
- Loop terjadwal (opsional): skill Cursor `loop` tiap N jam di `dev`

### 6.2 Loop

```text
1. Ensure branch = dev; pull origin/dev
2. Start stack: db migrate + backend + (frontend jika L3)
3. Run scripts/test-reports.sh
4. If PASS → write docs/reports/latest.md (PASS) → stop
5. If FAIL → for each failing ID:
   a. Repro once (same command) to confirm
   b. Read fix hint + CodeGraph/symbol around failing handler
   c. Patch minimal fix (no drive-by refactors)
   d. Re-run failing case → then full suite
   e. If still fail after 2 fix attempts → mark ESCALATE in report, stop that case
6. Commit + push origin/dev (Closeloop finish rule) dengan message yang jelasin bug yang difix
7. Append docs/reports/YYYY-MM-DD-HHMM.md + update latest.md
```

### 6.3 Report format (yang dibaca manusia)

`docs/reports/latest.md`:

```markdown
# Report test run — <ISO time>
Branch: dev @ <sha>
Result: PASS | FAIL | PASS_WITH_FIXES
Duration: …

## Summary
- Passed: R-ING-01, …
- Failed then fixed: R-FIX-04 → commit <sha> — notify kill switch ignored
- Escalated: …

## Changes this run
- <file>: <one-line why>

## Next human action
- None | Review escalated cases
```

Manusia **tidak** perlu re-klik flow; cukup buka file ini.

### 6.4 Guardrails auto-fix

- Hanya ubah kode terkait failing case (+ test yang membuktikan fix).
- Jangan ubah migrasi production data secara destruktif.
- Jangan commit secrets / real Resend keys; pakai mail log sink.
- Max **2** auto-fix attempts per case per run; sisanya escalate.
- UI flake (timeout) → retry 1× sebelum dianggap product bug.

---

## 7. Rencana implementasi (phased)

### Phase A — Foundation (1 session)

- [x] `scripts/test-reports.sh` orchestrator (migrate → seed isolasi → go test report tags → exit code)
- [x] Shared Go test helper: create user/project/key, HTTP client, cleanup
- [x] Port seed pattern dari `scripts/seed.sh` ke test package dengan DB terpisah / truncated tables
- [x] Folder `docs/reports/` + `.gitkeep` + template `latest.md`
- [x] Tambah npm/pnpm script `test:reports`

### Phase B — L0/L1/L2 cases (prioritas)

- [x] Implement R-ING-01…08, R-INB-01…07, R-MRG-01…03, R-FIX-01…06, R-MCP-01…04, R-SLACK-01…05, R-BOARD-01…09 sebagai Go tests (+ `TestR_GOLDEN_SC2`)
- [x] Mail sink assert untuk R-FIX-03/04
- [x] MCP JSON-RPC client helper

### Phase C — L3 UI + agent UX

- [x] Playwright scaffold; R-UI-01…07 (`frontend/e2e/reports.spec.ts`, `pnpm test:reports:ui`)
- [x] AGENTS.md section: report test loop pointing ke dokumen ini
- [ ] Optional: Closeloop MCP tool `run_report_tests` yang nge-wrap script + return summary

### Phase D — Harden

- [x] CI job on PR/push → `dev` (`.github/workflows/report-tests.yml`) — Go suite + coverage gate always; Playwright nightly / `workflow_dispatch` / label `run-ui-tests`
- [x] Flake quarantine list di dokumen ini (§11)
- [x] Coverage gate longgar: `pnpm test:reports:coverage` / `scripts/check-report-coverage.sh`

---

## 8. Mapping ke user stories / screens

| Stories / screens | Cases |
| --- | --- |
| US-06…US-09, S-18…S-20, demo | R-ING-*, R-UI-01 |
| US-10, S-12 selectors | R-ING-06 |
| US-11 identify | R-ING-05, R-FIX-05 |
| US-15…US-16 inbox/detail | R-INB-* |
| US-17…US-18 merge/status | R-MRG-*, R-INB-06 |
| US-21…US-25 fixed + notify | R-FIX-*, R-MCP-02 |
| F5 MCP | R-MCP-* |

---

## 9. Definition of done untuk plan ini

Plan dianggap **executed** (bukan hanya didokumentasikan) bila:

1. ~~`bash scripts/test-reports.sh` exit 0 di mesin lokal dengan Postgres.~~
2. ~~Minimal golden path §5 otomatis (API + MCP + notify sink).~~ (`TestR_GOLDEN_SC2`)
3. Satu run gagal-sengaja (kill switch) membuktikan auto-fix loop menulis `docs/reports/latest.md` dan commit fix. *(R-FIX-04 covered; full agent auto-fix loop = ongoing)*
4. ~~KANBAN punya checkbox / link ke suite ini di M1 dogfood area.~~
5. Cursor rule: `.cursor/rules/feature-automation-tests.mdc` — tiap fitur wajib bawa test.

---

## 10. Keputusan yang sudah dikunci

| Keputusan | Pilihan |
| --- | --- |
| Fokus | Report loop only |
| Output ke manusia | Markdown report di `docs/reports/` |
| Bug handling | Auto-fix di agent loop, max 2 tries, lalu escalate |
| UI | Playwright belakangan (Phase C); API+MCP dulu |
| Email di test | File/mail sink, bukan Resend production |
| Branch | Semua kerja test + fix di `dev` |
| CI | Go + coverage on every PR/push to `dev`; Playwright nightly / manual / label `run-ui-tests` |

---

## 11. Flake quarantine

Cases yang sengaja di-skip di CI (harus ada issue/alasan). Kosong = tidak ada quarantine.

| ID | Layer | Reason | Since | Owner |
| --- | --- | --- | --- | --- |
| — | — | — | — | — |

Cara quarantine: `t.Skip("quarantine: …")` di Go, atau `test.skip(…)` di Playwright, **plus** baris di tabel ini. Jangan biarkan flake silent.

---

*Update dokumen ini saat case baru ditambah atau ID di-retire.*
