# PRD Multi-repo per Project

Nov 19, 2026 · @Herlangga Wicaksono

Turunan dari [PRD Closeloop MVP](PRD%20Closeloop%20MVP.md). Menyentuh F1 (project), F5 (MCP), F8 (GitHub Issues) dan F10 (AI auto PR).

## Ringkasan

Satu project Saidloop mewakili satu produk, dan satu produk bisa punya beberapa repo: web, Android, iOS, backend, atau satu monorepo. Fitur ini membuat satu project bisa terhubung ke beberapa repo, tiap repo ditandai platform yang dia layani, lalu tiap laporan otomatis diarahkan ke repo yang benar berdasarkan platform yang dikirim widget atau SDK. Kalau platform tidak cukup untuk menentukan repo (misal bug sebenarnya di backend), laporan jatuh ke repo fallback dan AI agent bisa memindahkannya lewat MCP.

Jumlah repo per project dibatasi per plan, bukan dikunci 1 repo per project.

## Masalah

Hari ini satu project hanya bisa menyimpan satu repo. Integrasi GitHub App menyimpan `repo_full_name` tunggal di `integrations.config` (provider `github_app`), dan `autopr.go` menolak run kalau field itu kosong. Akibatnya:

1. Builder dengan app web, Android dan iOS di tiga repo harus memilih satu repo, atau membuat tiga project. Tiga project berarti tiga inbox, tiga board publik, laporan duplikat lintas platform tidak bisa digabung, dan langsung habis kuota project plan Indie (3).
2. AI auto PR (F10) untuk laporan iOS bisa jalan di repo web, gagal, dan tetap memotong satu kredit.
3. AI agent lokal (Cursor, Claude Code) yang dibuka di repo iOS menerima laporan web lewat `list_open_feedback`. Builder harus memilah sendiri, padahal justru itu yang mau dihilangkan Saidloop.

Catatan penting: loop inti (F5, MCP) **tidak butuh repo terhubung sama sekali**, karena agent builder sudah berjalan di repo lokalnya. Repo terhubung hanya wajib untuk F10 (auto PR) dan F8 (GitHub Issues). Jadi masalah inti fitur ini adalah *routing* laporan ke repo yang benar, bukan *jumlah* repo.

## Target user

| Persona | Bentuk repo | Kebutuhan |
| --- | --- | --- |
| Solo builder multi-platform | 2 sampai 4 repo: web, Android, iOS, kadang backend terpisah | Satu inbox, laporan otomatis ke repo yang benar |
| Builder monorepo | 1 repo berisi `apps/web`, `apps/android`, `apps/ios` | Satu repo, tapi agent tahu folder mana yang relevan |
| Builder Flutter atau React Native | 1 repo untuk Android dan iOS | Satu repo melayani dua platform |
| Studio kecil | Beberapa app klien, masing-masing 1 sampai 3 repo | Satu project per app klien, bukan satu project untuk semua klien |

## Tujuan dan metrik sukses

Angka di bawah usulan awal dan perlu disepakati.

| Metrik | Target | Cara ukur |
| --- | --- | --- |
| Routing otomatis | 90% laporan baru di project multi-repo punya repo tujuan tanpa campur tangan builder | Kolom `repo_id` di tiket |
| Routing benar | Kurang dari 10% tiket dipindah repo (reroute) setelah routing otomatis | Event `ticket_rerouted` |
| Auto PR di repo yang benar | 90% run auto PR tidak berakhir `needs_reroute` | Status `autopr_runs` |
| Project per produk | Builder multi-platform baru membuat 1 project, bukan 1 per platform | PostHog: jumlah project per org vs jumlah platform |
| Dogfooding | Bear Budget web dan app KMP dalam satu project | Bear Budget |

## Scope

### R1. Hubungkan beberapa repo ke satu project

Sebagai builder, saya bisa menghubungkan beberapa repo ke satu project dan menandai platform yang dilayani tiap repo.

- Dari halaman Integrations, builder memilih repo dari instalasi GitHub App (bisa lebih dari satu instalasi, misal akun pribadi dan org).
- Tiap repo punya: platform (`web`, `android`, `ios`, `backend`, `shared`), default branch, path opsional untuk monorepo (misal `apps/ios`), dan penanda fallback.
- Satu repo boleh melayani beberapa platform (monorepo, Flutter, React Native), masing-masing dengan path sendiri.
- Satu platform hanya boleh diarahkan ke satu repo dan path dalam satu project. Ini aturan keras supaya routing tidak ambigu.
- Tepat satu repo boleh ditandai fallback. Kalau project hanya punya satu repo, repo itu otomatis fallback.
- Jumlah repo dibatasi per plan (lihat Pricing). Batas dihitung per repo unik, bukan per pasangan platform dan path, jadi monorepo dihitung satu.

### R2. Routing laporan ke repo

Sebagai builder, saya tidak perlu memilah laporan iOS dari laporan web; tiap tiket sudah tahu repo tujuannya.

- Saat laporan masuk, server membaca `platform` dari widget atau SDK dan mengisi `repo_id` dan `repo_path` tiket berdasarkan mapping R1.
- Laporan dari wrapper Flutter dan React Native tetap mengirim `android` atau `ios`; mapping project menentukan keduanya ke repo yang sama.
- Kalau tidak ada mapping untuk platform itu, tiket diarahkan ke repo fallback. Kalau tidak ada fallback, tiket tanpa repo (`repo_id` kosong) dan tampil di filter "Belum ada repo" di inbox.
- Builder bisa mengganti repo tiket secara manual dari detail tiket. Penggantian dicatat di riwayat tiket.
- Routing hanya dari platform. Routing pintar berdasarkan isi laporan (misal "error 500" ke backend) di luar scope versi ini; lihat R4 untuk jalan keluarnya.

### R3. MCP sadar repo

Sebagai builder, agent di repo iOS saya hanya melihat laporan iOS, kecuali saya minta semua.

- `list_open_feedback` menerima parameter opsional `repo` (format `owner/name`). Bila diisi, hanya tiket dengan repo itu (plus tiket tanpa repo) yang dikembalikan. Bila kosong, perilaku sama seperti sekarang: semua tiket project.
- Panduan pasang MCP untuk Cursor dan Claude Code menyertakan instruksi agar agent mengisi `repo` dari `git remote get-url origin`.
- `get_feedback_context` menambahkan `repo`, `repo_path` dan `platform` tiket, supaya agent di monorepo langsung tahu folder yang relevan.
- Tool baru `reroute_feedback(ticket_id, repo, reason)`: agent yang menyimpulkan root cause ada di repo lain (misal backend) memindahkan tiket ke repo itu dengan alasan tertulis. Tiket muncul di antrean repo tujuan.
- `reroute_feedback` mengikuti aturan plan yang sama dengan `update_status`. Setelah [PRD Update Pricing dan Batas Fitur](PRD%20Update%20Pricing%20dan%20Batas%20Fitur.md) berlaku, tools ini tersedia di semua plan termasuk Free.

### R4. AI auto PR multi-repo

Sebagai builder, auto PR berjalan di repo yang benar, dan kalau salah repo, saya tidak kehilangan kredit.

- Run auto PR memakai `repo_id` tiket, bukan lagi `repo_full_name` tunggal di config integrasi.
- Runner mendapat token tulis hanya untuk repo tujuan. Untuk membaca konteks, runner boleh mendapat token baca untuk repo lain di project yang sama (misal backend), dibatasi instalasi GitHub App yang sudah diizinkan builder.
- Kalau agent menyimpulkan fix ada di repo lain, run berakhir dengan status baru `needs_reroute` berisi repo yang disarankan dan alasannya. Tidak ada PR dibuka, kredit dikembalikan, dan builder bisa menjalankan ulang di repo yang disarankan dengan satu klik.
- Satu run tetap satu repo dan satu PR. PR lintas repo (misal fix backend plus fix iOS sekaligus) di luar scope.
- Tiket tanpa repo tidak bisa dijalankan auto PR; tombolnya meminta builder memilih repo dulu.

### R5. GitHub Issues per repo

Sebagai builder, issue GitHub dibuat di repo yang sesuai dengan tiket.

- Buat issue (manual atau otomatis per tipe laporan, F8) memakai repo tiket.
- Sinkron status dua arah tetap per tiket: issue ditutup di repo mana pun yang tertaut, tiket jadi fixed.

## User stories

Melanjutkan penomoran dari [Closeloop User Stories dan Screens](Closeloop%20User%20Stories%20dan%20Screens.md) (US-01 sampai US-44). Peran sama: **Builder**, **User**, **Agent**. Kode S-xx merujuk ke daftar screen di dokumen itu.

| ID | Fitur | Sebagai | Saya ingin | Supaya | Screen | Milestone |
| --- | --- | --- | --- | --- | --- | --- |
| US-45 | R1 Repo | Builder | menghubungkan beberapa repo GitHub ke satu project | web, Android, iOS dan backend ada di satu inbox | S-13 | M2 |
| US-46 | R1 Repo | Builder | menandai platform yang dilayani tiap repo, dengan path untuk monorepo | laporan bisa diarahkan otomatis | S-13 | M2 |
| US-47 | R1 Repo | Builder | memilih satu repo sebagai fallback | laporan yang tidak cocok mapping tetap punya tujuan | S-13 | M2 |
| US-48 | R1 Repo | Builder | tahu batas repo plan saya dan apa yang terjadi saat downgrade | tidak kaget repo saya berhenti menerima laporan | S-13, S-15 | M2 |
| US-49 | R2 Routing | Builder | tiap tiket baru otomatis punya repo tujuan dari platform laporan | tidak perlu memilah laporan iOS dari web | S-06, S-07 | M2 |
| US-50 | R2 Routing | Builder | memfilter inbox per repo dan melihat tiket "Belum ada repo" | tahu mana yang belum punya tujuan | S-06 | M2 |
| US-51 | R2 Routing | Builder | mengganti repo tiket secara manual | routing yang salah bisa saya koreksi | S-07 | M2 |
| US-52 | R3 MCP | Agent | mengambil hanya laporan untuk repo tempat saya berjalan | tidak mengerjakan bug platform lain | – | M2 |
| US-53 | R3 MCP | Agent | tahu repo, path dan platform tiket dari konteks | langsung membuka folder yang relevan di monorepo | – | M2 |
| US-54 | R3 MCP | Agent | memindahkan tiket ke repo lain dengan alasan | bug backend sampai ke antrean backend | – | M2 |
| US-55 | Lintas platform | Agent dan Builder | diperingatkan saat menandai fixed tiket yang punya laporan dari platform di luar repo saya | pelapor platform lain tidak dikabari fix palsu | S-09 | M2 |
| US-56 | R4 Auto PR | Builder | auto PR berjalan di repo tiket, bukan satu repo default | fix iOS tidak dicoba di repo web | S-07, S-10 | M4 |
| US-57 | R4 Auto PR | Builder | run yang salah repo berhenti dengan saran repo dan kredit kembali | tidak membayar kesalahan routing | S-10 | M4 |
| US-58 | R4 Auto PR | Builder | mengizinkan runner membaca repo lain di project secara opsional | agent punya konteks backend tanpa izin tulis | S-13 | M4 |
| US-59 | R5 GitHub Issues | Builder | issue dibuat di repo yang sama dengan tiket | issue muncul di repo yang dikerjakan | S-07 | M3 |

### Kriteria penerimaan

**US-45.** Daftar repo diambil dari semua instalasi GitHub App milik builder. Repo yang sama tidak bisa dihubungkan dua kali ke satu project. Saat batas plan tercapai, tombol tambah nonaktif dengan teks batas dan tautan upgrade.

**US-46.** Platform yang bisa dipilih: web, android, ios, backend, shared. Satu repo boleh punya beberapa platform dengan path berbeda. Menyimpan mapping yang membuat satu platform menunjuk ke dua repo ditolak dengan pesan yang menyebut repo yang bentrok. Monorepo dihitung satu repo untuk batas plan.

**US-47.** Maksimal satu fallback per project. Project dengan satu repo otomatis menjadikannya fallback. Menghapus repo fallback meminta builder memilih fallback baru atau mengosongkannya.

**US-48.** Halaman Integrasi menampilkan "x dari y repo". Saat downgrade melewati batas, builder memilih repo yang tetap aktif; repo lain tetap tersimpan tapi tidak menerima routing, dan tiket barunya jatuh ke fallback. Tidak ada repo atau tiket yang dihapus.

**US-49.** Laporan dengan platform yang punya mapping mendapat `repo_id` dan `repo_path` saat dibuat. Laporan Flutter dan React Native (platform android atau ios) mengikuti mapping platform itu. Tanpa mapping, tiket ke fallback; tanpa fallback, `repo_id` kosong. Event `ticket_routed` tercatat dengan jenis otomatis, fallback, atau tanpa repo.

**US-50.** Filter repo tersedia di inbox bersama filter tipe, status, platform. Filter "Belum ada repo" menampilkan tiket dengan `repo_id` kosong.

**US-51.** Detail tiket punya pilihan repo. Perubahan tercatat di riwayat tiket dengan pelaku dan waktu, dan memicu event `ticket_rerouted` dengan sumber builder.

**US-52.** `list_open_feedback(repo: "owner/name")` hanya mengembalikan tiket repo itu plus tiket tanpa repo. Tanpa parameter, hasil sama dengan perilaku sekarang. Repo yang tidak terhubung ke project mengembalikan error yang jelas, bukan daftar kosong. Panduan pasang di S-05 menyertakan instruksi mengisi `repo` dari `git remote get-url origin`.

**US-53.** `get_feedback_context` mengembalikan `repo`, `repo_path` dan `platform`. Field kosong bila tiket tanpa repo.

**US-54.** `reroute_feedback(ticket_id, repo, reason)` hanya menerima repo yang terhubung ke project. Alasan wajib dan tampil di riwayat tiket. Tersedia di semua plan setelah PRD Update Pricing berlaku (lihat dokumen itu); sebelumnya mengikuti aturan tools tulis.

**US-55.** Bila tiket punya laporan dari platform yang tidak dilayani repo pemanggil, `mark_fixed` lewat MCP mengembalikan peringatan berisi platform yang belum tercakup dan butuh parameter `confirm: true` untuk lanjut. Di dashboard, modal S-09 menampilkan peringatan yang sama dan jumlah pelapor per platform. Status tetap satu per tiket.

**US-56.** Run auto PR memakai repo tiket. Tiket tanpa repo tidak bisa dijalankan; tombol meminta builder memilih repo. Kolom `autopr_runs.repo` berisi repo yang dipakai.

**US-57.** Run bisa berakhir `needs_reroute` dengan `suggested_repo` dan alasan, tanpa membuka PR. Satu kredit dikembalikan otomatis dan tercatat. S-10 menampilkan tombol "Jalankan di repo yang disarankan".

**US-58.** Pengaturan "beri agent akses baca ke repo lain di project ini" mati secara default. Token tulis runner selalu hanya untuk repo tujuan.

**US-59.** Issue GitHub dibuat di repo tiket. Tiket tanpa repo memakai repo fallback atau meminta builder memilih. Menutup issue di repo itu membuat tiket fixed.

## Di luar scope

- Routing berdasarkan isi laporan, stack trace atau Sentry event. Bisa jadi iterasi berikut setelah data reroute terkumpul.
- PR lintas repo dalam satu run auto PR.
- GitLab dan Bitbucket. Hanya GitHub App, sama seperti F10.
- Status fixed per platform dalam satu tiket (lihat Pertanyaan terbuka).

## Alur utama

1. Builder menghubungkan `bearbudget-web` (web, fallback) dan `bearbudget-app` (android dan ios, path `composeApp`).
2. User iOS melapor dari SDK. Laporan membawa `platform: ios`.
3. Server mengarahkan tiket ke `bearbudget-app`, path `composeApp`.
4. Agent di repo `bearbudget-app` memanggil `list_open_feedback(repo: "…/bearbudget-app")` dan hanya melihat tiket Android dan iOS.
5. Agent menemukan root cause ada di API. Agent memanggil `reroute_feedback` ke repo backend, atau builder menjalankan auto PR yang berakhir `needs_reroute`.
6. Fix di repo yang benar, `mark_fixed`, pelapor dikabari. Loop sama dengan PRD MVP.

## Pricing dan billing

Usulan ini **menambah satu kolom** ke tabel pricing PRD MVP. Harga, kuota project dan kuota laporan tidak berubah.

| Plan | Harga | Project | Repo per project (usulan) | Laporan per bulan |
| --- | --- | --- | --- | --- |
| Free | $0 | 1 | 3 | 50 |
| Indie | $12 / bulan | 3 | 5 | 1.000 |
| Studio | $39 / bulan | Tanpa batas | 10 | 10.000 |
| Business | Mulai $149 / bulan | Tanpa batas | Tanpa batas | Sesuai kontrak |

Alasan angka di atas:

- **Free 3, bukan 1.** PRD menjual Saidloop untuk web, Android dan iOS. Kalau Free hanya 1 repo, builder multi-platform langsung mentok di produk utamanya sendiri sebelum merasakan nilai. Biaya repo terhubung untuk Saidloop hampir nol, dan di Free repo hanya dipakai untuk routing MCP karena auto PR (0 kredit starter) dan GitHub Issues hanya untuk plan berbayar.
- **Indie 5.** Cukup untuk web, Android, iOS, backend dan satu shared library. Batas ini terutama mencegah satu project dipakai untuk banyak app sekaligus demi menghindari batas 3 project.
- **Studio 10.** Project sudah tanpa batas, jadi tidak ada insentif menumpuk app dalam satu project. Angka 10 hanya pagar kewarasan untuk UI dan routing.
- **Business tanpa batas**, sesuai pola plan Business lainnya.

Di layar Change plan, batas ini ditampilkan di baris sekunder setelah kuota laporan, misal "1 project · 50 reports / mo · 3 repos / project", bukan di baris fitur utama.

Penegakan memakai pola entitlement yang sama (`LimitsForPlan`, tambah field `MaxReposPerProject`). Saat downgrade, repo yang melebihi batas tidak dihapus: routing ke repo itu dibekukan (tiket baru jatuh ke fallback) sampai builder memilih repo mana yang tetap aktif.

**Pendapat jujur soal batas repo sebagai alat monetisasi:** lemah. Builder tidak upgrade karena butuh repo ke-6. Pendorong upgrade yang nyata tetap kuota laporan, semua tools MCP, dan kredit auto PR. Batas repo ada untuk mencegah penyalahgunaan batas project, bukan untuk menghasilkan uang. Jangan jadikan ini baris utama di halaman pricing.

## Kebutuhan teknis

- **Data:** tabel baru `project_repos` (id, project\_id, installation\_id, full\_name, default\_branch, is\_fallback, created\_at) dan `project_repo_routes` (project\_id, platform, repo\_id, path) dengan unique (project\_id, platform). Kolom baru `tickets.repo_id` dan `tickets.repo_path`.
- **Migrasi:** project yang sudah punya `repo_full_name` di `integrations.config` dipindah menjadi satu baris `project_repos` dengan `is_fallback = true`. Tiket lama diisi repo itu. Field lama dibaca sebagai fallback selama satu rilis lalu dihapus.
- **`autopr_runs.repo`** sudah ada dan tetap dipakai; isi dari repo tiket. Tambah status `needs_reroute` dan kolom `suggested_repo`.
- **Keamanan:** builder hanya bisa menghubungkan repo dari instalasi GitHub App miliknya. Token tulis runner hanya untuk satu repo per run, token baca repo lain hanya bila builder mengaktifkan "beri agent akses baca ke repo lain di project ini" (default mati).
- **Event analitik:** `repo_connected`, `ticket_routed` (otomatis, fallback, tanpa repo), `ticket_rerouted` (oleh agent atau builder), `autopr_needs_reroute`.

## Rilis bertahap

1. **Bersama M2 (mobile):** R1, R2, R3. Begitu SDK Android dan iOS jalan, Bear Budget sudah butuh routing. Lolos kalau laporan web dan app KMP Bear Budget masuk satu project dan agent di masing-masing repo hanya melihat laporannya sendiri.
2. **Bersama M3:** R5 (GitHub Issues per repo).
3. **Bersama M4:** R4 (auto PR multi-repo dan `needs_reroute`). Lolos kalau 5 run auto PR di Bear Budget berjalan di repo yang benar tanpa reroute manual.

## Risiko dan pertanyaan terbuka

| Risiko | Dampak | Penanganan |
| --- | --- | --- |
| Banyak bug "frontend" sebenarnya bug backend | Routing berdasarkan platform sering salah, kredit auto PR terbuang | Repo fallback, `reroute_feedback`, kredit dikembalikan saat `needs_reroute`; ukur lewat `ticket_rerouted` sebelum membangun routing pintar |
| Agent tidak mengisi `repo` di `list_open_feedback` | Agent tetap melihat semua laporan, manfaat R3 hilang diam-diam | Instruksi di panduan pasang; pertimbangkan token MCP yang dikunci ke satu repo |
| Builder memakai satu project untuk banyak app | Batas 3 project Indie bisa diakali | Batas 5 repo per project; terima bahwa ini tidak bisa dicegah sempurna |
| Scope MVP sudah 12 fitur | Fitur ini menambah beban M2 | R1 sampai R3 kecil (tabel, routing, satu parameter MCP); R4 menumpang M4 yang memang menyentuh auto PR |

- [ ] **Tiket gabungan lintas platform.** Satu tiket bisa berisi laporan web dan iOS (gabung duplikat, F4). Repo tiket mengikuti laporan pertama, jadi `mark_fixed` dari repo web bisa mengabari pelapor iOS padahal iOS belum diperbaiki. Rekomendasi untuk versi ini: MCP dan dashboard memberi peringatan saat menandai fixed tiket yang punya laporan dari platform di luar repo yang memanggil, tanpa memecah status per platform. Perlu keputusan apakah itu cukup.
- [ ] Apakah token MCP sebaiknya bisa dikunci ke satu repo (lebih aman dan tidak bergantung pada agent mengisi parameter), atau cukup parameter `repo`?
- [ ] Apakah angka 3, 5, 10 repo per project disetujui? Angka ini tebakan, belum ada data berapa repo yang dimiliki builder target. Tanyakan di interview M0.
- [ ] Beda kode dengan PRD dan UI: `entitlements.go` memberi Indie `MaxSeats: 3`, sementara PRD MVP dan layar Change plan hanya menyebut seat di Studio (5 seats). Kode yang menyimpang. Perlu diputuskan: Indie memang 1 seat (ubah kode), atau 3 seat (tambahkan ke PRD dan UI).
- [ ] Apakah kredit auto PR benar-benar dikembalikan saat `needs_reroute`? Kalau iya, biaya model run itu ditanggung Saidloop. Rekomendasi: kembalikan, karena gagal routing adalah kesalahan produk, bukan builder.

## Referensi desain

Desain dibaca lewat Pencil MCP dari `closeloop.pen` (cara pakai di [Closeloop User Stories dan Screens](Closeloop%20User%20Stories%20dan%20Screens.md#referensi-desain-closelooppen)). Semua story di dokumen ini sudah punya desain v2; peta lengkapnya juga ada di frame `SimGS` (PRD Coverage).

| Kebutuhan | Frame (node ID) | Catatan |
| --- | --- | --- |
| R1 Repo di Integrations (US-45, US-47, US-48, US-58) | S-13 v2 Repositories `ho9Yy` | "3 of 5 repos", badge Fallback, toggle akses baca (default mati). Abaikan teks repo di kartu GitHub Issues (`herlangga/bear-budget`); issue ikut repo tiket |
| R1 Tambah repo + bentrok platform (US-45, US-46, US-47) | S-13 v2 Add Repository `DMYRO` | Daftar instalasi, repo yang sudah terhubung nonaktif, path per platform, error yang menyebut repo bentrok, "Use as fallback" |
| R1 Batas plan (US-48) | S-13 v2 Free plan limits `dmcSk` | Tombol tambah nonaktif saat batas, teks upgrade |
| R1 Downgrade (US-48) | S-13 v2 Downgrade `vZyTd` | Pilih repo yang tetap aktif |
| R2 Filter repo di inbox (US-49, US-50) | S-06 v2 Repo filter `z9TjRd` | Kolom Repo, menu dengan jumlah per repo dan "No repo yet" |
| R2 Repo di detail tiket (US-49, US-51) | S-07 v2 Repo and reroute `HMFLR`, S-07 v2 No repo yet `ajZz9` | Properti Repo, pemilih repo, entri riwayat routing dan reroute |
| R3 Panduan MCP (US-52) | S-05 v2 Repo-aware `G05BeG` | Instruksi isi `repo` dari `git remote get-url origin` |
| R3 Konteks dan reroute agent (US-53, US-54) | API; alasan reroute tampil di riwayat S-07 v2 `HMFLR` | Tidak ada screen khusus |
| US-55 Peringatan lintas platform | S-09 v2 Platform not covered `Mixlu` | Jumlah pelapor per platform, checkbox konfirmasi, tombol "Mark fixed, notify 2 on Web". Kartu In-app banner harus ikut jumlah yang dikabari, bukan tetap "3 reporters" |
| R4 Auto PR (US-56, US-57, US-58) | S-10 v2 Needs reroute `aHJCX` | Status Needs reroute, refund kredit, repo yang disarankan, "Run in bearbudget-api". Kolom PR baris itu harus "—", bukan `#318` |
| R5 GitHub Issues per repo (US-59) | S-07 v2 Repo and reroute `HMFLR` | "Create issue in <repo>"; tanpa repo meminta pilih repo (`ajZz9`) |
