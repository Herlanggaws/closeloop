# Tech Plan Closeloop MVP

Nov 3, 2026 · @Herlangga Wicaksono

Frontend Next.js, backend Go, sisanya dipilih supaya bisa dikerjakan satu orang dengan bantuan AI dan bisa di-self-host. Payment gateway ditunda; plan diatur manual di database dulu.

## Keputusan stack

Semua bagian server cukup Postgres plus object storage, tanpa Redis atau message broker, supaya biaya kecil dan self-hosting jadi satu `docker compose up`.

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Frontend dashboard dan board publik | Next.js (App Router), TypeScript, Tailwind, shadcn/ui, TanStack Query | Ditentukan; board publik pakai SSR untuk SEO |
| Backend API | Go, Gin, arsitektur domain/application/infrastructure/interfaces | Ditentukan; pola sama dengan backend Bear Budget, kode bisa dipakai ulang |
| Database | PostgreSQL 16 | Sudah dikuasai; full-text search untuk inbox, JSONB untuk konteks laporan |
| Akses DB dan migrasi | sqlc + pgx, goose | Query type-safe tanpa ORM, mudah dibaca AI agent |
| Background job | River (job queue di atas Postgres) | Tanpa Redis; dipakai untuk notifikasi, integrasi, auto PR, pembersihan data |
| Object storage | Cloudflare R2 (cloud), MinIO (self-host) | API S3 yang sama; R2 tanpa biaya egress untuk screenshot dan replay |
| Email | Resend (cloud), SMTP biasa (self-host) | API sederhana, template React Email bisa dipakai bareng Next.js |
| Web widget | TypeScript + Preact, esbuild, Shadow DOM | Bundle kecil (target di bawah 30 KB gzip) dan CSS tidak bentrok dengan app builder |
| Screenshot web | modern-screenshot (DOM ke gambar) | Tanpa izin layar; elemen sensitif diblur sebelum render |
| Session replay | rrweb, dimuat terpisah | Standar industri, rekaman DOM bukan video |
| SDK Android | Kotlin, OkHttp, WorkManager | Antrean offline bawaan Android |
| SDK iOS | Swift, URLSession background, Swift Package | Tanpa dependency pihak ketiga |
| Wrapper Flutter dan React Native | Platform channel (Flutter), Turbo Module + Expo config plugin (RN) | Membungkus SDK native, logika tidak ditulis dua kali |
| MCP server | Go, MCP Go SDK resmi, transport Streamable HTTP | Satu binary dengan API; pola token sama dengan MCP Bear Budget |
| Auth | JWT sendiri (access 15 menit + refresh cookie), Google OAuth | Sama dengan Bear Budget yang sudah lolos audit SEC1 sampai SEC8 |
| SSO | crewjam/saml dan coreos/go-oidc | Jalan juga di self-host, tanpa vendor seperti WorkOS |
| AI auto PR | GitHub App + runner container terisolasi + Claude Agent SDK | Agent menulis fix di sandbox, hasilnya PR; tidak pernah merge |
| Hosting cloud | Vercel (Next.js), Fly.io (API, worker, runner), Neon (Postgres) | Murah di awal, region global, mesin runner bisa dinyalakan per job |
| Observability | Sentry, PostHog, log JSON (slog) | Sudah dipakai di Bear Budget |
| Billing | Ditunda | Kolom `plan` di tabel organisasi diisi manual sampai payment gateway dipilih |

## Arsitektur

&#91;embedded content: arsitektur cloud · 4 klien, 1 API, 1 worker\]

Semua klien bicara ke satu API Go; screenshot dan replay diunggah langsung dari klien ke R2 lewat URL bertanda tangan. Email, integrasi, dan auto PR selalu lewat worker, sehingga API tetap cepat walau pihak luar lambat.

## Struktur repo

Satu monorepo supaya AI agent melihat kontrak API, server, dan klien sekaligus. Bagian TypeScript dikelola pnpm + Turborepo; Go dan SDK native punya build sendiri.

```text
closeloop/
  apps/
    api/            Go: REST API, MCP, webhook (satu binary, mode api)
      cmd/server    entrypoint api + worker (flag --mode)
      internal/     domain, application, infrastructure, interfaces
      db/           migrasi goose + query sqlc
    web/            Next.js: dashboard, onboarding, board publik, landing
    runner/         image container untuk AI auto PR (Claude Agent SDK)
  packages/
    widget/         web widget (Preact) -> cdn.closeloop.dev/w.js
    replay/         modul rrweb, dimuat terpisah oleh widget
    js-sdk/         klien API untuk Node dan browser (dipakai widget dan web)
    emails/         template React Email
    api-spec/       openapi.yaml, sumber tipe Go dan TypeScript
  sdks/
    android/        Kotlin, rilis ke Maven Central
    ios/            Swift Package
    flutter/        paket pub.dev, membungkus android + ios
    react-native/   paket npm + Expo config plugin
  deploy/
    docker/         Dockerfile api, web, runner
    compose/        docker-compose self-host (api, web, postgres, minio)
    helm/           chart Kubernetes untuk Business
  docs/             PRD, tech plan, backlog, ADR
  AGENTS.md         aturan untuk AI agent (pola dari Bear Budget)
```

Kontrak API ditulis di `packages/api-spec/openapi.yaml`. Tipe TypeScript dibangkitkan dengan openapi-typescript dan handler Go dicek dengan oapi-codegen, jadi widget, SDK, dan dashboard tidak bisa melenceng dari API.

## Data model

Semua data dimiliki organisasi; tiap query dashboard difilter `org_id`. Laporan individual (`reports`) dikelompokkan ke tiket (`tickets`), sehingga gabung duplikat cukup memindahkan `ticket_id`.

| Tabel | Kolom penting | Relasi |
| --- | --- | --- |
| `organizations` | id, name, plan, auto\_pr\_credits, sso\_enforced | punya banyak users lewat memberships |
| `users` | id, email, password\_hash, google\_sub |  |
| `memberships` | org\_id, user\_id, role (owner, member, viewer) | users x organizations |
| `projects` | id, org\_id, name, platforms\[\], board\_slug, board\_domain, notify\_enabled, sensitive\_selectors | milik organizations |
| `project_keys` | id, project\_id, public\_key, revoked\_at | key ingest, hanya bisa membuat laporan |
| `mcp_tokens` | id, project\_id, token\_hash, prefix, scopes, last\_used\_at | satu atau lebih per project |
| `reporters` | id, project\_id, external\_user\_id, email, email\_verified | user akhir dan pemberi vote |
| `tickets` | id, project\_id, type, status, title, is\_public, vote\_count, report\_count, fixed\_at, fixed\_note | punya banyak reports |
| `reports` | id, ticket\_id, reporter\_id, message, platform, context (JSONB), app\_version, created\_at | satu laporan dari widget atau SDK |
| `attachments` | id, report\_id, kind (screenshot, replay), storage\_key, size\_bytes | file di R2 atau MinIO |
| `ticket_events` | id, ticket\_id, actor (user, agent, integration), kind, payload | riwayat status, catatan, merge |
| `notifications` | id, ticket\_id, reporter\_id, channel (email, in\_app), sent\_at, seen\_at | kabar ke pelapor |
| `integrations` | id, project\_id, provider, config, secret\_enc | Slack, GitHub, Linear, Jira, Sentry, PostHog |
| `external_links` | ticket\_id, provider, external\_id, url, last\_synced\_at | tiket ke issue luar |
| `votes` | ticket\_id, reporter\_id | board publik |
| `comments` | id, ticket\_id, reporter\_id or user\_id, body, hidden | board publik |
| `autopr_runs` | id, ticket\_id, status, branch, pr\_url, cost\_usd, tokens, log\_key | satu run agent |
| `credit_ledger` | id, org\_id, delta, reason, run\_id | jejak kredit auto PR |
| `sso_connections` | id, org\_id, kind (saml, oidc), metadata, domain | plan Business |
| `audit_logs` | id, org\_id, actor, action, target, ip, created\_at | append-only |
| `licenses` | key, org\_name, expires\_at, features | dipakai instalasi self-host |

Screenshot dan replay tidak pernah disimpan di Postgres. Konteks laporan (browser, device, route, Sentry event id, PostHog session id) masuk JSONB supaya platform baru tidak butuh migrasi.

## API

Satu binary Go melayani empat permukaan dengan auth berbeda. Token dari satu permukaan selalu ditolak di permukaan lain.

| Permukaan | Prefix | Auth | Dipakai oleh |
| --- | --- | --- | --- |
| Ingest publik | `/v1/ingest/*` | Public key project + rate limit | Widget, SDK mobile |
| Dashboard | `/api/*` | Session JWT + role | Next.js dashboard |
| MCP | `/mcp` | Bearer token MCP (hash SHA-256) | Cursor, Claude Code, agent lain |
| Webhook masuk | `/webhooks/{provider}` | Signature per provider | GitHub App, Slack, Linear, Jira |

**Ingest (dipanggil klien):**

- `POST /v1/ingest/reports` membuat laporan dan mengembalikan `report_id` plus URL upload bertanda tangan.
- `PUT` ke URL tersebut mengunggah screenshot dan replay langsung ke R2, tanpa lewat API.
- `POST /v1/ingest/reports/{id}/complete` menandai lampiran selesai diunggah.
- `GET /v1/ingest/updates?reporter=…` mengambil kabar "sudah dibereskan" yang belum dilihat, untuk banner in-app.
- `POST /v1/ingest/identify` mencatat user id, email, dan versi app dari builder.

**MCP tools:**

| Tool | Input | Output | Plan |
| --- | --- | --- | --- |
| `list_open_feedback` | type?, status?, platform?, limit | daftar tiket ringkas | Semua |
| `get_feedback_context` | ticket\_id | pesan, konteks, URL screenshot sementara, Sentry dan PostHog | Semua |
| `update_status` | ticket\_id, status | tiket terbaru | Berbayar |
| `add_note` | ticket\_id, body | event baru | Berbayar |
| `mark_fixed` | ticket\_id, note | jumlah pelapor yang dikabari | Berbayar |

**Webhook keluar (opsional untuk builder):** `ticket.created`, `ticket.status_changed`, `ticket.fixed`, ditandatangani HMAC.

Error memakai format satu bentuk: `{ "error": { "code": "PLAN_REQUIRED", "message": "…" } }`, mengikuti pola `PREMIUM_REQUIRED` Bear Budget.

## Widget dan SDK

Semua klien menjalankan urutan yang sama: kumpulkan konteks, ambil dan masking screenshot, kirim laporan, unggah lampiran ke URL bertanda tangan, simpan ke antrean bila gagal.

**Web widget (`packages/widget`)**

- Dipasang lewat `<script src="https://cdn.closeloop.dev/w.js" data-key="pk_…">` atau `npm i @closeloop/widget`.
- UI dirender di Shadow DOM supaya CSS app builder tidak bocor ke dalam dan sebaliknya.
- Masking: elemen dengan `data-closeloop-mask` atau selector dari pengaturan project diblur sebelum screenshot diambil.
- Replay: modul rrweb dimuat hanya bila plan dan pengaturan mengizinkan, menyimpan buffer 2 menit terakhir di memori, dikirim hanya saat user melapor.
- Antrean di IndexedDB bila jaringan gagal, dicoba ulang dengan backoff.

**Android (`sdks/android`)**

- `Closeloop.init(context, "pk_…")`, `Closeloop.identify(...)`, `Closeloop.show()`.
- Screenshot lewat PixelCopy dari window aktif; view bertanda `closeloopMask` ditutup sebelum gambar disimpan.
- Deteksi goyang lewat SensorManager, bisa dimatikan.
- Antrean di file lokal, dikirim WorkManager saat jaringan tersedia.

**iOS (`sdks/ios`)**

- API sama: `Closeloop.start(key:)`, `identify`, `show()`.
- Screenshot dengan UIGraphicsImageRenderer; view dengan `closeloopMask = true` ditutup.
- Goyang lewat `motionEnded`, antrean di file lokal, kirim pakai URLSession background.

**Flutter dan React Native**

- Hanya meneruskan panggilan ke SDK native lewat platform channel (Flutter) dan Turbo Module (RN).
- Masking widget Flutter dan komponen RN dilakukan dengan mengirim koordinat area sensitif ke SDK native sebelum screenshot.
- Expo didukung lewat config plugin, tanpa eject.

Tes kompatibilitas: Bear Budget web dan app KMP Bear Budget dipakai sebagai app uji pertama, ditambah contoh app minimal untuk tiap platform di folder SDK masing-masing.

## Integrasi, AI auto PR, session replay

Semua kerja yang lambat atau bergantung ke pihak luar berjalan sebagai job River, jadi request user tidak pernah menunggu Slack, GitHub, atau model AI.

**Integrasi**

- Satu interface Go `Provider` dengan method `Connect`, `CreateIssue`, `HandleWebhook`, `Notify`; tiap provider (Slack, GitHub Issues, Linear, Jira) satu implementasi.
- OAuth token disimpan terenkripsi (AES-GCM, kunci dari env) di `integrations.secret_enc`.
- Sinkron status masuk lewat webhook: issue ditutup di Linear atau GitHub, job `sync_ticket` mengubah tiket jadi fixed lalu memicu notifikasi pelapor.
- Sentry dan PostHog hanya baca: event id dan session id dari konteks laporan diubah jadi link dan ringkasan di detail tiket.

**AI auto PR**

1. Builder memasang GitHub App Closeloop dengan izin contents read/write dan pull requests write pada repo terpilih.
2. Klik "Jalankan auto PR" membuat baris `autopr_runs` dan job River; kredit dipotong di `credit_ledger` dalam transaksi yang sama.
3. Worker menyalakan satu Fly Machine dari image `apps/runner` dengan installation token GitHub berumur pendek dan konteks tiket.
4. Di dalam runner, Claude Agent SDK meng-clone repo, membaca konteks lewat MCP Closeloop, membuat fix, menjalankan perintah test dari `closeloop.yml` di repo bila ada, lalu push branch dan membuka PR.
5. Batas per run: 15 menit, biaya model maksimum per run, tanpa akses jaringan selain GitHub, Anthropic API, dan registry paket. Mesin dihapus setelah selesai.
6. Hasil (link PR, ringkasan, biaya, log) disimpan ke `autopr_runs`; webhook GitHub `pull_request.closed` dengan merged=true menandai tiket fixed.

**Session replay**

- rrweb merekam di browser, buffer 2 menit, dikirim terkompresi gzip sebagai lampiran `replay` hanya saat laporan dikirim.
- Diputar di dashboard dengan rrweb-player; input dimasking di sisi klien, jadi server tidak pernah menerima teks yang diketik user.
- Retensi: 7 hari (Studio) dan 30 hari (Business), dihapus oleh job harian.

## Auth, SSO, audit log, keamanan

Pola auth Bear Budget dipakai ulang karena sudah lolos audit SEC1 sampai SEC8; yang baru hanya SSO, key publik, dan token MCP per project.

- **Login dashboard:** email + password (argon2id) atau Google. Access token JWT 15 menit, refresh token di cookie httpOnly, hash refresh disimpan dan bisa dicabut.
- **SSO (Business):** SAML via crewjam/saml dan OIDC via coreos/go-oidc. Domain email terdaftar diarahkan ke IdP; bila `sso_enforced`, login password dimatikan untuk org itu.
- **Role:** owner (billing, SSO, hapus project), member (kelola tiket dan integrasi), viewer (baca saja). Dicek di layer application, bukan di handler.
- **Public key:** hanya boleh `POST` ke ingest. Rate limit token bucket per key dan per IP di memori tiap instance, ditambah aturan rate limit Cloudflare di depan API.
- **Token MCP:** prefix `cl_mcp_`, disimpan sebagai SHA-256, ditampilkan sekali, scope baca atau tulis sesuai plan.
- **Audit log:** setiap aksi sensitif (login, ubah role, buat atau cabut token, ekspor, semua panggilan tool MCP yang menulis, setiap run auto PR) ditulis ke `audit_logs` dalam transaksi yang sama dengan aksinya. Tabel append-only; ekspor CSV dan JSON.
- **Lampiran:** bucket privat; dashboard dan MCP hanya mendapat URL bertanda tangan berumur 10 menit.
- **Header dan CORS:** ingest mengizinkan semua origin (widget dipasang di domain builder) tapi tanpa cookie; dashboard API hanya origin app.
- **Secret:** semua kunci lewat env; di cloud memakai Fly secrets dan Vercel env.

## Infra, deploy, self-host, observability, testing

Cloud dan self-host memakai image Docker yang sama; bedanya hanya env (R2 atau MinIO, Resend atau SMTP, Neon atau Postgres lokal).

| Bagian | Cloud | Self-host |
| --- | --- | --- |
| Dashboard dan board publik | Vercel | Container `web` (Next.js standalone) |
| API dan MCP | Fly.io, 2 instance, region terdekat ke Postgres | Container `api --mode=api` |
| Worker (River) | Fly.io, 1 instance | Container `api --mode=worker` |
| Runner auto PR | Fly Machines, dinyalakan per job | Docker di host yang sama atau dimatikan |
| Database | Neon Postgres | Postgres 16 container |
| File | Cloudflare R2 + CDN untuk `w.js` | MinIO |
| Email | Resend | SMTP |

**Deploy:** GitHub Actions per folder. Push ke `main` menjalankan test, build image, migrasi goose, lalu deploy API dan worker. Widget dan SDK dirilis lewat tag versi (`widget-v*`, `android-v*`, dan seterusnya).

**Self-host:** `deploy/compose` untuk satu server, `deploy/helm` untuk Kubernetes. Lisensi dicek offline lewat kunci bertanda tangan Ed25519, tanpa panggilan ke server Closeloop.

**Observability:** Sentry di API, worker, web, dan widget (sampling rendah). PostHog untuk funnel onboarding dan aktivasi. Log JSON dengan `slog`, request id diteruskan dari ingest sampai job.

**Testing:**

- Go: unit test per use case, integration test dengan testcontainers Postgres.
- Kontrak: tiap endpoint di `openapi.yaml` dites terhadap server sungguhan.
- Web dan widget: Vitest untuk logika, Playwright untuk alur lapor sampai inbox.
- SDK mobile: unit test antrean dan masking, satu tes end to end di emulator per platform di CI.
- MCP: tes yang memanggil kelima tool lewat klien MCP sungguhan.

## Urutan pengerjaan

Urutan teknis mengikuti milestone PRD; tiap milestone berakhir dengan sesuatu yang dipakai Bear Budget sungguhan.

1. **M1, inti web:** monorepo + `openapi.yaml`, migrasi tabel inti (organizations sampai notifications), auth dari Bear Budget, ingest API + upload R2, widget web, dashboard onboarding, inbox, detail, MCP lima tool, email Resend. Pasang di Bear Budget web.
2. **M2, mobile:** SDK Android dan iOS, antrean offline, masking; lalu wrapper Flutter dan React Native dengan contoh app. Pasang di app KMP Bear Budget.
3. **M3, tool tim dan publik:** River job untuk integrasi, provider Slack, GitHub Issues, Linear, Jira; board publik SSR dengan vote dan verifikasi email; modul rrweb dan player.
4. **M4, AI dan Business:** GitHub App, image runner, ledger kredit, halaman runs; SAML/OIDC, audit log, docker compose, Helm, lisensi Ed25519.
5. **M5, beta publik:** payment gateway dipilih dan dipasang di belakang kolom `plan` yang sudah ada.

## Keputusan terbuka

- [ ] Domain final (contoh di dokumen ini memakai `closeloop.dev`).
- [ ] Mulai dari fork backend Bear Budget atau repo bersih yang menyalin modul auth dan MCP saja? Rekomendasi: repo bersih, salin modul.
- [ ] Fly.io atau server VPS seperti Bear Budget untuk API? Rekomendasi: Fly.io untuk region global dan runner per job.
- [ ] Batas biaya model per run auto PR (perlu diukur di M4).
