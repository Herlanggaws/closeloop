# Brief Penyesuaian Kode ke Desain

Nov 19, 2026 · Untuk agent (Cursor / Claude Code) yang menyamakan kode dengan `closeloop.pen` setelah update desain 19 Nov.

Dokumen ini adalah brief kerja per task. Sumber kebenaran tetap frame di `closeloop.pen`; brief ini memberi tahu **frame mana, file mana, apa yang beda, dan kapan dianggap selesai**. Aturan umum ada di `.cursor/rules/pen-design-source.mdc` dan `pen-design-frontend.mdc`. Status tiap task dilacak di [KANBAN](./KANBAN.md#brief-penyesuaian-kode-ke-desain).

## Cara kerja untuk setiap task

1. Buka `closeloop.pen` di Pencil (Cursor). Pastikan file sudah di-save.
2. Ambil frame dengan node ID dari brief: `TakeScreenshot(["<id>"])` lalu `Print(Get("<id>", {depth: 4}))` untuk struktur dan copy persis.
3. Samakan **struktur, urutan section, label, copy, state kosong/error, dan warna token** dengan frame. Data contoh di frame (Bear Budget, Rina, angka) bukan data asli; yang disalin adalah bentuk dan copy UI.
4. Bagian di kolom **Abaikan dari desain** jangan ditiru; itu sisa desain yang sudah diketahui salah.
5. Tambah atau ubah tes sesuai `.cursor/rules/feature-automation-tests.mdc`.
6. Setelah selesai, centang task di KANBAN dan tambah entri changelog (`frontend/src/lib/changelog.ts`) sesuai `update-changelog-on-finish.mdc`.

Konvensi umum:

- Error API: `{ "error": { "code": "...", "message": "..." } }`. Kode baru di brief ini: `PREMIUM_REQUIRED` (fitur butuh plan lebih tinggi), `QUOTA_LOCKED`, `REPO_LIMIT`, `PLATFORM_CONFLICT`, `REPO_NOT_CONNECTED`.
- Label plan di UI: badge kecil abu ("Indie", "Studio") di pojok kartu + tombol `Upgrade to Indie` / `Upgrade to Studio`. Pola visualnya ada di kartu Jira di S-13 `wAub0`.
- **Plan Business ditahan (on hold) per 26 Nov, fokus Indie dan Studio** (lihat D-22). Desain masih menampilkan kartu dan copy Business; selama sebelum M6, semua yang berbau Business di desain diabaikan. Tabel plan di D-05 dan D-06 tetap mencantumkan Business sebagai acuan untuk M6, tapi tidak dirender.
- Domain belum final. Jangan hardcode `saidloop.com` atau `saidloop.dev` dari desain; pakai config yang sudah ada (`EMAIL_FROM`, host MCP di kode).
- UI tidak menyebut nama penyedia pembayaran (Polar, Lemon Squeezy, dll). Bahasa yang dipakai: subscribed / subscription, misal "Plans are switched manually until you're subscribed." Nama penyedia hanya boleh di Privacy, Terms dan DPA.

## Urutan pengerjaan

| Fase | Task | Kenapa urutan ini |
| --- | --- | --- |
| A | D-01 sampai D-06, D-22 | Murni copy dan layout di screen yang sudah ada, plus menyembunyikan plan Business sampai M6. Hampir tanpa backend. Cepat dan langsung menyamakan app dengan desain |
| B | D-07 sampai D-10 | Pricing P1 dan P2: backend gating + UI. Butuh A selesai supaya copy-nya tidak bertabrakan |
| C | D-11 sampai D-19 | Multi-repo: migrasi data, routing, MCP, UI. Paling besar |
| D | D-20, D-21 | Menunggu keputusan badge dan seat Indie. Jangan dikerjakan sebelum diputuskan |

---

## Fase A · Samakan screen yang sudah ada

### D-01 · S-05 Connect MCP: semua plan dapat semua tools

- **Frame:** S-05 `HcHA7` (footer `J8j3y`). Coach mark F5: `ObRdo`, `KdiK2`, `nMRDS`.
- **File:** `frontend/src/design-screens/ConnectMCP.tsx`, `frontend/src/design-screens/McpServer.tsx`, `frontend/src/lib/tours.ts`.
- **Sekarang:** `scopeLabel` = `"Read-only · Free plan"` bila token tanpa `write`, plus blok upsell `!canWrite`.
- **Target:** footer berbunyi persis `Every plan includes all MCP tools, mark_fixed too.` Hapus label "Read-only · Free plan" dan upsell `!canWrite` setelah D-07 live. Sebelum D-07 live, sembunyikan upsell tapi biarkan label scope apa adanya.
- **Abaikan dari desain:** footer lama "Free plan includes read-only tools. mark_fixed needs Indie." yang masih tampil di latar coach mark F5.
- **Selesai bila:** tidak ada string "read-only" atau "needs Indie" di `ConnectMCP.tsx`, `McpServer.tsx`, `tours.ts`; screenshot `/app/onboarding/mcp` cocok dengan `HcHA7`.

### D-02 · S-06 Inbox empty: checklist sesuai plan

- **Frame:** S-06 Empty `PN6mj`, checklist `c1NiLS`.
- **File:** `frontend/src/design-screens/InboxEmpty.tsx`.
- **Target checklist (urutan, judul, subjudul, aksi):**

| # | Judul | Subjudul | Aksi |
| --- | --- | --- | --- |
| 1 | Install the widget | `<Project> is reporting` | (selesai, centang hijau) |
| 2 | Connect your coding agent | `Claude Code is connected` | (selesai) |
| 3 | Invite a teammate | Free/Indie: `Team seats come with Studio (5 seats)` | Free/Indie: `Upgrade to Studio`. Studio ke atas: `Invite` |
| 4 | Send new reports to Slack | Free: `Slack comes with Indie` | Free: `Upgrade to Indie`. Indie ke atas: `Connect` |
| 5 | Connect your repos | `Route iOS, Android and web reports to the right repo` | `Set up` → `/app/settings/integrations` |

- Header kartu: `Get the most out of Saidloop` dengan counter `x / 5`.
- Hapus item lama "Turn on reporter notifications / Upgrade to Indie for mark_fixed".
- Sidebar di project Free tidak menampilkan baris "auto PR credits left" (Free punya 0 kredit) dan badge jumlah Inbox harus 0 saat kosong.
- **Selesai bila:** checklist berubah sesuai plan org (uji Free, Indie, Studio); tidak ada copy mark_fixed upsell.

### D-03 · S-07 Report detail: panel Reporters, tombol issue, urutan aktivitas

- **Frame:** S-07 `mxSU2` (properties `TYB6n`, timeline `oUhh7`, header actions `qBmXy`).
- **File:** `frontend/src/design-screens/ReportDetail.tsx`.
- **Target:**
  - Panel kanan, urutan: `Status` → `Reporters` → `Context` → `Linked` → note composer.
  - Panel **Reporters**: header `Reporters` dengan ringkasan kanan `3 · Web 2, iOS 1` (total · jumlah per platform). Satu baris per pelapor: avatar inisial (atau `?`), nama (atau `Anonymous`), email (atau `no email` abu), ikon + label platform di kanan.
  - Tombol header ketiga: tombol issue sesuai integrasi yang boleh dipakai plan. Indie: `Create GitHub issue`. Linear/Jira hanya muncul untuk Studio ke atas dan bila terhubung.
  - Timeline **lama ke baru** (atas paling lama). Saat ini `events` di-`reverse()`; samakan dengan frame.
- **Backend:** pastikan `GET /api/tickets/:id` mengembalikan daftar pelapor (nama, email, platform) bukan hanya `reporters.total`. Kalau belum ada, tambahkan `reporters.items[]` dan `reporters.by_platform`.
- **Selesai bila:** ticket hasil merge lintas platform menampilkan semua pelapor dengan platformnya; tidak ada tombol Linear/Jira di org Indie.

### D-04 · S-13 Integrations: label plan pada Linear dan Jira

- **Frame:** S-13 `wAub0`, grid `vf3rD`.
- **File:** `frontend/src/design-screens/Integrations.tsx` (`NOTIFY_CATALOG`).
- **Target:** Linear dan Jira sama-sama punya badge `Studio`. Di org di bawah Studio, tombolnya `Upgrade to Studio` (bukan Configure) dan deskripsi Linear `Create Linear issues with two-way status sync`. Webhooks tombolnya `Add endpoint`. Tombol Upgrade memakai gaya secondary (outline), bukan hitam primer.
- **Selesai bila:** org Indie melihat Linear dan Jira terkunci; org Studio melihat Configure. Gating backend ada di D-08.

### D-05 · S-15 Billing: Change plan dengan baris limit dan usage lengkap

- **Frame:** S-15 `jRMCb` (current plan `aEDyd`, usage `zgz4m`, Change plan, invoices `Ho69c`).
- **File:** `frontend/src/design-screens/Billing.tsx`, `frontend/src/lib/usage.ts`.
- **Target `PLANS`:**

| Plan | Harga | Baris fitur (blurb) | Baris limit (sekunder, abu, kecil) |
| --- | --- | --- | --- |
| Free | `$0` | `Widget, inbox, full MCP loop` | `1 project · 50 reports / mo · 3 repos / project · 1 seat` |
| Indie | `$12` | `Slack & GitHub Issues, public board, no badge` | `3 projects · 1,000 reports / mo · 5 repos / project · 1 seat` |
| Studio | `$39` | `5 seats, branding, Linear & Jira, replay 7d` | `Unlimited projects · 10,000 reports / mo · 10 repos / project` |
| Business | `From $149` | `SSO, audit log, replay 30d, self-host option` | `Unlimited projects · Contract quota · Unlimited repos` |

  - Header Change plan kanan: `Every limit below is enforced in the product, not just listed.`
  - Kartu plan aktif: border gelap + label `Current plan` di bawah baris limit.
  - Usage (`Usage this month · resets <tanggal>`), urutan: `Reports`, `Projects`, `Auto PR credits` (format `17 of 25 used`, bar hitam), `Seats` (`1 of 1`), `Repos in <project>` (`3 of 5`). Seats dan Repos datang dari `usage.seats` dan `usage.repos` (tambah `repos?: UsageCounter` di `OrgUsage`; isi setelah D-11).
  - Invoices: jangan tampilkan baris plan Free $0.
  - Header halaman tanpa nama penyedia pembayaran. Catatan Change plan saat belum subscribe: `Plans are switched manually until you're subscribed.` Kredit: `1 credit = 1 Auto PR run. Paid plans get a starter pack. Credit packs are coming soon.` Jangan tampilkan nama milestone (M5) ke user.
- **Abaikan dari desain:** seat count Indie tetap mengikuti `LimitsForPlan` (lihat D-21).
- **Selesai bila:** baris limit tiap kartu sama dengan tabel di atas; angka diambil dari satu sumber (`PLANS` atau entitlements), bukan ditulis dua kali.

### D-06 · S-01 Landing pricing

- **Frame:** S-01 Pricing `BPPVw`, kartu `Hnt6T` (Free `jTo3E`, Indie `B9JCqI`, Studio `F4gCOH`, Business `QjiLi`).
- **File:** `frontend/src/app/LandingPage.tsx` (sekitar baris 3370–3700).
- **Target isi kartu:**
  - **Free** · `$0 forever` · `The full loop on one app.` · limit `1 project · 50 reports / mo · 3 repos / project` · fitur: `Web widget and mobile SDKs`, `Inbox and tickets`, `Full MCP loop, including mark_fixed`, `Reporter notifications`, `“Powered by Saidloop” badge`.
  - **Indie** · `$12 / month` · `For solo builders shipping with AI.` · limit `3 projects · 1,000 reports / mo · 5 repos / project · 1 seat` · fitur: `Everything in Free`, `Slack and GitHub Issues`, `Public board and voting`, `No Saidloop badge`, `Auto PR starter credits`.
  - **Studio** · `$39 / month` · limit `Unlimited projects · 10,000 reports / mo · 10 repos / project · 5 seats` · fitur: `Everything in Indie`, `Your own widget branding`, `Linear and Jira`, `Session replay, 7 days`.
  - **Business** · `$149 / month and up` · limit `Unlimited projects, repos and seats · custom report volume` · fitur: `Everything in Studio`, `SSO with SAML or OIDC`, `Audit log with export`, `Session replay, 30 days`, `Self-hosting, annual license`.
  - Baris limit tampil di bawah deskripsi plan, sebelum daftar fitur, gaya sekunder.
- **Selesai bila:** string "MCP read-only tools" dan "All MCP tools, including mark_fixed" hilang; `data-pencil-name` ikut diganti.

### D-22 · Sembunyikan plan Business (on hold)

> Update 26 Nov: Business tidak lagi dijadwalkan di M6, tapi ditahan tanpa tanggal. Flag tetap `false`; jangan dibalik sebelum Herlangga memutuskan Business dilanjutkan. Tombol "Log in with SSO" di `AuthForm.tsx` juga sudah disembunyikan di balik flag (26 Nov).

Keputusan 19 Nov: semua fitur Business (SSO, audit log, self-host, replay 30 hari, kuota kontrak) pindah ke M6. Sampai M6, user hanya melihat **Free, Indie, Studio**. Kode Business yang sudah ada **jangan dihapus**; cukup disembunyikan supaya gampang dibalikkan di M6.

- **Satu sumber flag:** tambah `export const BUSINESS_PLAN_VISIBLE = false` di `frontend/src/lib/plans.ts` (file baru) dan pakai di semua tempat di bawah. Di M6 cukup ubah ke `true`.
- **Landing `frontend/src/app/LandingPage.tsx`:** kartu Business (`data-pencil-name="Business"`, sekitar baris 3940–4120) tidak dirender; grid pricing jadi 3 kolom dengan lebar kartu sama, rata tengah. `PLAN_PRICES.business` boleh tetap ada. Blok add-on "AI auto PR credits" tetap tampil.
- **FAQ `frontend/src/lib/landing-faq.ts`:** hapus atau sembunyikan item "Can I self-host Saidloop?" (jawabannya menyebut Business).
- **JSON-LD `frontend/src/components/LandingJsonLd.tsx`:** deskripsi offer jadi `Free plan available; Indie and Studio paid tiers`.
- **Billing `frontend/src/design-screens/Billing.tsx`:** filter `PLANS` tanpa `business` di Change plan; grid 3 kolom. Bila org yang sedang login memang `business` (data lama/internal), kartu Current plan tetap menampilkan Business apa adanya dan tidak error.
- **Sidebar `frontend/src/components/AppSidebar.tsx`:** sembunyikan nav `SSO & audit` (`/app/settings/sso`), kecuali org saat ini `business`.
- **Route `frontend/src/app/app/settings/sso/page.tsx`:** redirect ke `/app/inbox` untuk org non-Business, sama seperti `self-host/page.tsx` sekarang.
- **Tour `frontend/src/lib/tours.ts`:** tour `sso` dan self-host tidak dijalankan sebelum M6.
- **Copy upsell:** `ReportDetail.tsx` "Session replay is available on Studio and Business plans." → `Session replay is available on Studio.`; `SSOAudit.tsx` teks upgrade ke Business tidak tampil (halaman sudah tersembunyi). Kartu Studio di landing dan Billing tidak menyebut "Everything in Business" atau sejenisnya.
- **Contact `frontend/src/app/contact/page.tsx`:** hapus "Business self-host" dari daftar topik sales.
- **Backend `PATCH /api/org/plan`:** tolak `business` untuk perubahan plan self-serve dengan `PREMIUM_REQUIRED`/`INVALID_INPUT` dan pesan `Business is not available yet.` Org yang sudah `business` tetap jalan. `ValidPlan` tidak diubah (dipakai di tempat lain).
- **Biarkan:** Privacy, Terms dan DPA (bahasa legal "if offered"), gating `business` di backend (`entitlements.go`, `audit.go`, `ReplayAllowed`).
- **Selesai bila:** dengan akun Free/Indie/Studio, tidak ada kata "Business", "SSO", "self-host", "audit log" atau "30 days" yang terlihat di landing, FAQ, Billing, sidebar, ReportDetail, dan tour; `/app/settings/sso` redirect; `PATCH /api/org/plan {"plan":"business"}` ditolak. Tambah tes UI untuk landing (3 kartu) dan Go test untuk penolakan plan.

---

## Fase B · Pricing: gating di backend

### D-07 · Free dapat semua tools MCP (P1, US-60, US-61, US-63)

- **File:** `backend/internal/interfaces/http/server.go` (sekitar baris 852, pembuatan token), `backend/internal/interfaces/http/mcp.go` (baris 47, `canWrite`), migrasi baru `backend/db/migrations/<nomor berikutnya>_free_mcp_write.sql` (terakhir saat ini `020`).
- **Ubah:**
  - Token baru selalu `scopes: ["read","write"]`. Hapus `write := org.Plan != "free"`.
  - `canWrite := contains(scopes, "write")` tanpa syarat plan.
  - Migrasi: tambah `write` ke scope semua token aktif (belum dicabut) milik org Free. Catat satu baris audit per org (`actor: system`, `action: mcp.token.scope_upgraded`).
  - Tiket yang semua laporannya terkunci kuota: `get_feedback_context`, `update_status`, `mark_fixed` mengembalikan error `QUOTA_LOCKED` dengan `reset_at` (tanggal reset kuota) dan `upgrade_url`. Sekarang jalur ini mengembalikan `PLAN_REQUIRED`.
- **Tes:** Go test MCP per plan: Free bisa `update_status`, `add_note`, `mark_fixed`; tiket terkunci kuota mengembalikan `QUOTA_LOCKED`; migrasi tidak menyentuh token yang sudah dicabut.

### D-08 · Gating integrasi dan board per plan (P2, US-64, US-69)

- **File:** `backend/internal/application/entitlements.go`, handler Slack, GitHub Issues, Linear/Jira (`tracker_issues.go`), board (`server.go` sekitar publish board).
- **Ubah:** tambah `IntegrationAllowed(plan, provider string) bool` dan `BoardAllowed(plan) bool`:

| Fitur | Free | Indie | Studio | Business |
| --- | --- | --- | --- | --- |
| Slack, GitHub Issues | ✗ | ✓ | ✓ | ✓ |
| Linear, Jira | ✗ | ✗ | ✓ | ✓ |
| Publish board publik | ✗ | ✓ | ✓ | ✓ |
| Sentry, PostHog, Webhooks, GitHub App | ✓ | ✓ | ✓ | ✓ |

  - Endpoint connect dan create-issue menolak dengan `PREMIUM_REQUIRED` (HTTP 402) + `required_plan`.
  - Integrasi yang sudah terhubung sebelum rilis tetap jalan (jangan putus koneksi lama).
- **UI:** S-13 v2 Free `dmcSk`: section header `Notify and track · Slack and GitHub Issues need Indie`; kartu Slack dan GitHub Issues badge `Indie`, deskripsi `Post new reports and status changes to a channel` / `Create issues and close tickets when they close`, tombol `Upgrade to Indie`. File: `Integrations.tsx`.
- **Tes:** tabel entitlement di atas dites per plan (US-69).

### D-09 · `MaxReposPerProject` di entitlements

- **File:** `entitlements.go`, response usage (`/api/me`, `/api/org/usage`), `frontend/src/lib/usage.ts`.
- **Ubah:** `PlanLimits.MaxReposPerProject`: Free 3, Indie 5, Studio 10, Business 0 (tanpa batas). Usage mengembalikan `repos: { used, limit }` untuk project aktif. Dipakai D-05 dan D-12.

### D-10 · `usage.subscribed` dari penyedia pembayaran

- **File:** handler usage, `Billing.tsx` (pill "Manual until Subscribed" sudah menunggu field ini).
- **Ubah:** saat integrasi Polar jadi (M5), isi `subscribed: true` untuk org dengan langganan aktif. Sampai itu, jangan kirim field.

---

## Fase C · Multi-repo

Desain lengkap ada di frame v2 dan peta story di `SimGS`. Spesifikasi perilaku di [PRD Multi-repo per Project](./PRD%20Multi-repo%20per%20Project.md).

### D-11 · Data dan migrasi

- **Migrasi baru** `<nomor berikutnya>_project_repos.sql`:
  - `project_repos(id, project_id, installation_id, full_name, default_branch, is_fallback, routing_paused, created_at)`, unique `(project_id, full_name)`.
  - `project_repo_routes(project_id, platform, repo_id, path)`, unique `(project_id, platform)`. `platform` ∈ `web, android, ios, backend, shared`.
  - `tickets.repo_id`, `tickets.repo_path` (nullable).
  - `autopr_runs`: status `needs_reroute`, kolom `suggested_repo`, `reroute_reason`.
  - `projects.allow_cross_repo_read boolean default false`.
- **Migrasi data:** `repo_full_name` di config integrasi `github_app` (`store.go:2141`, `autopr.go:74`) jadi satu baris `project_repos` dengan `is_fallback = true`; tiket lama diisi repo itu. Field lama tetap dibaca sebagai fallback satu rilis.

### D-12 · S-13 v2 Repositories (US-45, US-47, US-48, US-58)

- **Frame:** `ho9Yy`. Varian batas Free: `dmcSk`.
- **File:** `Integrations.tsx` (section baru di atas "Notify and track"), API `GET/POST/PATCH/DELETE /api/projects/:id/repos`.
- **Layout:** section label `Repositories`; kartu dengan judul `Repositories`, subjudul `Reports route to a repo by platform. Platforms with no repo go to the fallback.`, kanan `3 of 5 repos` (mono) + tombol primer `+ Add repository`.
  - Tabel kolom: `Repository` (ikon GitHub, `owner/name` mono, sub `GitHub App · <account>`), `Platforms and paths` (chip ikon + label + path mono abu), `Branch` (mono), `Routing` (`Fallback` biru atau `Platform` abu), menu `⋯`.
  - Baris toggle di dasar kartu: `Let auto PR agents read other repos in this project` / `Gives the runner read-only context, like your backend. Write access is always limited to the ticket's repo.` Default mati.
  - Saat batas tercapai (`dmcSk`): subjudul jadi `Free includes 3 repos per project. Upgrade to Indie for 5.`, counter `3 of 3 repos`, tombol Add nonaktif.
- **Abaikan dari desain:** teks repo di kartu GitHub Issues (`herlangga/bear-budget`); kartu itu cukup `Create issues from tickets`, karena issue dibuat di repo tiket.

### D-13 · Add repository modal (US-45, US-46, US-47)

- **Frame:** `DMYRO`.
- **Konten:** judul `Add a repository`; sub `Pick a repo from your GitHub App installations, then choose the platforms it serves. 3 of 5 repos used.`
  - Daftar repo dengan search `Search repositories`, dikelompokkan per instalasi (`herlangga · personal`, `bearbudget · organization`); repo yang sudah terhubung abu + `Already connected` dan tidak bisa dipilih.
  - `Platforms this repo serves` / `Each platform routes to one repo. For a monorepo, add the folder path.` Lima baris: checkbox + ikon + nama + input `Path (optional), e.g. apps/<platform>`.
  - Bentrok platform: baris merah + `<Platform> already routes to <repo>. Remove it there first, or uncheck it here.` Backend menolak dengan `PLATFORM_CONFLICT` berisi repo yang bentrok.
  - Checkbox `Use as fallback` / `Reports from platforms with no repo land here. Replaces <fallback saat ini>.`
  - Footer kiri `A monorepo counts as one repo toward your plan.`; tombol `Cancel`, `Add repository`.
  - Lewat batas: `REPO_LIMIT`.

### D-14 · Downgrade: pilih repo yang tetap routing (US-48)

- **Frame:** `vZyTd`.
- **Konten:** judul `Choose 3 repos to keep routing`; sub `<Project> moved to Free, which includes 3 repos per project. This project has 5.` Daftar repo dengan checkbox dan status kanan: `Fallback stays on`, `Keeps routing`, `Paused`. Catatan: `Paused repos stay connected but stop receiving reports. New tickets for their platforms go to the fallback. Nothing is deleted, and upgrading turns routing back on.` Footer `3 of 3 selected`, tombol `Stay on Indie` dan `Keep these 3`.
- **Backend:** set `project_repos.routing_paused = true` untuk repo yang tidak dipilih; router melewatkan repo paused.

### D-15 · Routing tiket + S-06 v2 inbox (US-49, US-50)

- **Frame:** `z9TjRd`.
- **Backend:** saat laporan dibuat, isi `repo_id`/`repo_path` dari `project_repo_routes` berdasar `platform`; tanpa mapping → fallback; tanpa fallback → kosong. Event `ticket_routed` (`auto | fallback | none`). `GET /api/tickets?repo=<id|none>`.
- **UI (`Inbox.tsx`):** chip filter baru `Repo: All` setelah `Platform: All`. Menu: `All repos` + jumlah, satu baris per repo (`owner/name` mono + jumlah), pemisah, `No repo yet` dengan ikon lingkaran putus-putus oranye + jumlah, catatan `Tickets land here only when their platform has no repo and no fallback is set.` Kolom tabel baru `Repo` (ikon + nama repo pendek mono) di antara `Platform` dan `Status`; kolom terakhir berheader `Age`.

### D-16 · S-07 v2 repo, reroute, dan "No repo yet" (US-51, US-53, US-54, US-56, US-59)

- **Frame:** `HMFLR` (ada repo, sudah di-reroute), `ajZz9` (tanpa repo).
- **UI (`ReportDetail.tsx`):** properti `Repo` di antara Status dan Reporters: nama repo mono + sub `Rerouted from <repo> by <actor> · <platform>` bila pernah dipindah; klik membuka pemilih repo (daftar repo + platform, catatan `The change is saved to this ticket's history.`).
  - Tanpa repo: nilai `No repo yet` + teks `Web has no repo, and this project has no fallback. Pick one to run auto PR or create an issue.`; `Run auto PR` nonaktif dengan tooltip `Pick a repo for this ticket first. Auto PR runs in the ticket's repo.`
  - Tombol issue: `Create issue in <repo pendek>` bila tiket punya repo; `Create GitHub issue` meminta pilih repo bila belum.
  - Timeline: entri sistem `Saidloop routed this Web report to <repo>` / `Saidloop couldn't route this Web report: no repo for Web, no fallback`; entri reroute `<actor> rerouted to <repo>: “<reason>”`.
- **API:** `PATCH /api/tickets/:id { repo_id }` → event `ticket_rerouted` (sumber builder). `get_feedback_context` menambah `repo`, `repo_path`, `platform`.

### D-17 · MCP sadar repo + S-05 v2 (US-52, US-54)

- **Frame:** `G05BeG`.
- **Backend (`mcp.go`):** `list_open_feedback({ repo?: "owner/name" })` → tiket repo itu + tiket tanpa repo; repo tak terhubung → `REPO_NOT_CONNECTED`. Tool baru `reroute_feedback({ ticket_id, repo, reason })`, alasan wajib, tersedia di semua plan.
- **UI (`ConnectMCP.tsx`, `McpServer.tsx`):** bila project punya lebih dari 1 repo, tampilkan blok di bawah snippet Step 2: judul `This project has <n> repos. Tell your agent which one it's in.`, kode `# AGENTS.md or .cursor/rules` / `When calling list_open_feedback, pass repo from` / `` `git remote get-url origin` (owner/name). ``, catatan `Without it, the agent sees reports for every repo in the project.`

### D-18 · Peringatan lintas platform saat mark fixed (US-55)

- **Frame:** `Mixlu`.
- **UI (`MarkFixed.tsx`):** bila tiket punya pelapor dari platform yang tidak dilayani repo tiket, tampilkan blok oranye di atas Release note: judul `<Platform> reporters may not have the fix yet`, isi `This ticket is routed to <repo>, but one report came from <platform>. Marking it fixed tells every reporter, including on <platform>.`, chip per platform (`Web · 2 reporters` dengan centang hijau, `iOS · 1 reporter` dengan ikon peringatan), checkbox `iOS is fixed too, notify all 3 reporters` (default mati).
  - Checkbox mati: hanya pelapor platform yang tercakup yang dikabari. Footer kiri `2 reporters will be notified`, tombol `Mark fixed, notify 2 on Web`. Checkbox nyala: tombol kembali `Mark fixed and notify`, semua pelapor dikabari.
  - Sub kartu Email dan In-app banner harus ikut jumlah yang benar-benar dikabari.
- **Abaikan dari desain:** kartu In-app banner di frame tetap bilang `3 reporters on Web and iOS` saat checkbox mati; itu salah.
- **Backend:** `PATCH fixed` menerima `notify_platforms[]`. MCP `mark_fixed` mengembalikan peringatan dengan platform yang belum tercakup dan butuh `confirm: true`.

### D-19 · Auto PR multi-repo + S-10 v2 (US-56, US-57, US-58)

- **Frame:** `aHJCX`.
- **Backend:** run memakai `tickets.repo_id`; tiket tanpa repo ditolak. Runner bisa berakhir `needs_reroute` dengan `suggested_repo` + alasan, tanpa membuka PR, dan otomatis refund 1 kredit (ledger).
- **UI (`AutoPRRuns.tsx`):** status `Needs reroute` (ikon oranye, baris berlatar oranye muda), kolom Cost `Refund` hijau, kolom Pull request `—`. Kartu detail di bawah tabel: judul `Run #<n> stopped: the fix belongs in another repo`, sub `#<ticket> <judul> · ran in <repo>`, pill hijau `1 credit refunded`, blok mono `Suggested repo: <repo>` + kutipan alasan, footer `No pull request was opened.`, tombol `Dismiss` dan `Run in <repo pendek>`. Panel kanan `Repositories`: `Each run uses the ticket's repo. Write access covers that repo only.`, daftar repo + platform, `Read access to other repos: off|on`.
- **Abaikan dari desain:** baris Needs reroute menampilkan PR `#318`; harus `—`.

---

## Fase D · Menunggu keputusan

### D-20 · Badge "Powered by Saidloop" hanya di Free (US-65, US-66)

- **Status:** tunggu keputusan badge. Jangan dikerjakan sebelum disetujui.
- **Frame:** S-31 `s67yG`.
- **Sekarang:** widget selalu menampilkan `Powered by Saidloop` dengan tautan ke saidloop.com di semua plan (cari `class="powered"` di `packages/widget/src/index.tsx`); email selalu `Sent with Saidloop`. Tautan belum membawa parameter UTM.
- **Target bila disetujui:** project Free saja. Launcher: tooltip hover `Feedback by Saidloop ↗`. Form dan sent: footer `Powered by Saidloop`. Banner: baris terakhir `Powered by Saidloop`. Email: baris terakhir footer dengan logo mark + `Powered by Saidloop`. Tautan `<landing>/?utm_source=badge&utm_medium={surface}&utm_campaign={project_id}`. Indie ke atas: tidak ada badge sama sekali. Widget membaca flag `badge` dari config project (`/v1/ingest/...` config), hilang dalam satu menit setelah upgrade.

### D-21 · Seat Indie (US-67)

- **Status:** tunggu keputusan 1 atau 2 seat. Rekomendasi PRD: 1.
- **Frame:** S-14 v2 `APr9x`.
- **Target:** `entitlements.go` Indie `MaxSeats` sesuai keputusan. S-14: subjudul `<Plan> plan · <used> of <limit> seat used`; saat undangan ditolak, banner merah `Invite not sent. Indie includes 1 seat.` / `Existing members like <nama> keep their access. New invites need Studio, which has 5 seats.` + tombol `Upgrade to Studio`; header Members kanan `<n> active · over the Indie seat limit` bila lewat batas. Anggota lama tidak dikeluarkan.
- **Abaikan dari desain:** project switcher sidebar `Pixel Studio · Studio` di frame ini.

---

## Ringkasan "abaikan dari desain"

| Frame | Yang salah | Yang benar |
| --- | --- | --- |
| Coach mark F5 `ObRdo`, `KdiK2`, `nMRDS` | Footer "read-only" | Footer S-05 `HcHA7` |
| S-14 v2 `APr9x` | Switcher "Pixel Studio · Studio" | Plan org yang aktif |
| S-14 `k4JbSl` | Kuota 312 / 1,000 di Studio | Kuota dari usage |
| S-10 v2 `aHJCX` | PR `#318` di baris Needs reroute | `—` |
| S-09 v2 `Mixlu` | Kartu banner "3 reporters" saat hanya 2 dikabari | Jumlah yang dikabari |
| S-13 v2 `ho9Yy` | Kartu GitHub Issues menyebut `herlangga/bear-budget` | `Create issues from tickets` |
| S-31, S-05, S-23 | Domain `saidloop.com` / `saidloop.dev` | Config di kode |
