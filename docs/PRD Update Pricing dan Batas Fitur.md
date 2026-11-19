# PRD Update Pricing dan Batas Fitur

Nov 19, 2026 · @Herlangga Wicaksono

Turunan dari [PRD Closeloop MVP](PRD%20Closeloop%20MVP.md) (bagian Pricing dan billing) dan [PRD Multi-repo per Project](PRD%20Multi-repo%20per%20Project.md). PRD MVP tidak diubah; dokumen ini yang berlaku untuk pricing setelah disetujui.

## Ringkasan

Tiga perubahan, harga tetap sama:

1. **Free dapat loop penuh.** Semua tools MCP, termasuk `update_status`, `add_note` dan `mark_fixed`, plus notifikasi ke pelapor. Rem Free tetap kuota 50 laporan per bulan dan 1 project.
2. **Batas repo per project** dari PRD Multi-repo masuk tabel pricing, tampil di baris sekunder kartu plan.
3. **Seat Indie dibereskan.** Kode memberi 3 seat, PRD dan UI tidak menyebut seat. Usulan: Indie 1 seat.

## Masalah

- **Free tidak bisa merasakan janji utama produk.** Pembeda Saidloop adalah loop tertutup: AI agent memperbaiki lalu `mark_fixed`, pelapor dikabari. Di Free, token MCP dibuat tanpa scope `write` (`server.go`, `write := org.Plan != "free"`) dan `mcp.go` menolak tools tulis untuk plan Free. Builder Free hanya bisa membaca laporan lewat AI, jadi nilai utama baru terasa setelah bayar. Itu urutan yang terbalik.
- **Catatan jujur:** loop sebenarnya sudah *bisa* ditutup di Free, lewat dashboard. Ubah status ke fixed di dashboard memicu notifikasi tanpa cek plan. Jadi yang dikunci hanya penutupan oleh AI, yang justru bagian paling unik. Mengunci bagian paling unik di Free tidak masuk akal kalau tujuan Free adalah aktivasi.
- **Gating di kode tidak sama dengan janji di UI.** Kartu Indie menjual "Slack & GitHub Issues", tapi backend tidak mengecek plan untuk Slack, GitHub Issues, maupun notifikasi. Yang benar-benar dicek plan hari ini hanya: jumlah project, kuota laporan, seat, MCP tulis, session replay, dan kredit auto PR.
- **Seat tidak konsisten.** `entitlements.go` memberi Indie `MaxSeats: 3`; PRD MVP, kartu plan dan landing hanya menyebut seat di Studio (5).

## Tabel pricing baru

Yang berubah ditandai **tebal**.

| Plan | Harga | Project | Repo per project | Seat | Laporan per bulan | Isi utama |
| --- | --- | --- | --- | --- | --- | --- |
| Free | $0 | 1 | **3** | 1 | 50 | Widget dan SDK, inbox, **semua tools MCP, notifikasi pelapor**, badge "Powered by Saidloop" |
| Indie | $12 / bulan | 3 | **5** | **1** | 1.000 | Slack dan GitHub Issues, board publik, **tanpa badge**, kredit starter auto PR |
| Studio | $39 / bulan | Tanpa batas | **10** | 5 | 10.000 | Branding sendiri, Linear dan Jira, session replay 7 hari |
| Business | Mulai $149 / bulan | Tanpa batas | **Tanpa batas** | Tanpa batas | Sesuai kontrak | SSO, audit log, session replay 30 hari, opsi self-hosting |
| Add-on AI auto PR | Per kredit | Semua plan berbayar | | | Sesuai kredit | Tidak berubah |

Yang tidak berubah: harga, tahunan bayar 10 dapat 12, early access 50 builder pertama, perilaku lewat kuota (laporan tetap diterima, baru bisa dibaca setelah upgrade atau bulan berganti).

## Detail perubahan

### P1. Loop penuh di Free

- Token MCP Free dibuat dengan scope `read` dan `write`. `mcp.go` berhenti memeriksa `plan != "free"` untuk tools tulis.
- `mark_fixed` dan ubah status ke fixed di Free memicu notifikasi email dan banner in-app, sama dengan plan berbayar.
- **Token lama:** token MCP Free yang sudah ada tidak punya scope `write`. Saat rilis, scope token Free yang masih aktif dinaikkan lewat migrasi, supaya builder tidak perlu membuat token baru dan memasang ulang di Cursor atau Claude Code.
- Email notifikasi dan banner dari project Free membawa "Powered by Saidloop" dengan tautan ke landing. Ini sekaligus rem kecil dan jalur akuisisi: setiap pelapor yang dikabari melihat nama Saidloop.
- Notifikasi tetap tunduk ke kuota: laporan yang terkunci kuota tidak bisa dibaca, jadi tidak bisa di-`mark_fixed` lewat MCP sampai bulan berganti atau upgrade.

### P2. Batas yang benar-benar ditegakkan di kode

Isi kartu plan harus sama dengan gating di backend. Yang perlu ditambahkan:

- Slack dan GitHub Issues: ditolak untuk Free dengan `PREMIUM_REQUIRED` (saat ini tidak dicek).
- Badge "Powered by Saidloop": tampil di widget, SDK, email dan banner untuk Free; hilang di Indie ke atas.
- Repo per project: field `MaxReposPerProject` di `PlanLimits` (lihat PRD Multi-repo).
- Board publik: tetap fitur Indie seperti di PRD MVP. Perlu dicek apakah saat ini sudah dikunci; kalau belum, kunci bersamaan.

### P3. Seat Indie

Usulan: **Indie 1 seat**, ubah `MaxSeats: 3` jadi `1`.

- Persona Indie adalah solo builder. Seat adalah alasan utama naik ke Studio; memberi 3 seat di $12 memotong alasan itu.
- PRD, kartu plan dan landing sudah konsisten dengan "seat hanya di Studio"; yang perlu diubah cukup satu baris kode.
- Kalau sudah ada org Indie dengan lebih dari 1 anggota, anggota yang ada tidak dikeluarkan, tapi undangan baru ditolak sampai di bawah batas.

Alternatif: Indie 2 seat (builder plus satu partner). Lebih ramah untuk tim 2 orang yang disebut di persona "1 sampai 3 orang", tapi harus ditulis di kartu plan dan landing. Ini masih keputusan terbuka (lihat bawah).

### P4. Tiket lintas platform

Dari PRD Multi-repo: kalau satu tiket berisi laporan dari beberapa platform dan di-`mark_fixed` dari repo yang hanya melayani sebagian platform, MCP dan dashboard memberi peringatan sebelum menandai fixed. Status tidak dipecah per platform di versi ini. Berlaku di semua plan.

## User stories

Melanjutkan penomoran setelah PRD Multi-repo (US-45 sampai US-59). Story yang bergantung pada keputusan terbuka ditandai **menunggu keputusan**.

| ID | Perubahan | Sebagai | Saya ingin | Supaya | Screen | Milestone |
| --- | --- | --- | --- | --- | --- | --- |
| US-60 | P1 Loop penuh | Builder Free | membuat token MCP dengan semua tools | agent saya bisa menutup tiket sebelum saya bayar | S-05 | M1 |
| US-61 | P1 Loop penuh | Builder Free | token MCP lama saya otomatis dapat hak tulis | tidak perlu memasang ulang MCP | S-05 | M1 |
| US-62 | P1 Loop penuh | User | dikabari saat laporan saya beres, walau app builder memakai Free | merasa didengar | S-21, S-23 | M1 |
| US-63 | P1 Loop penuh | Agent | tahu kalau tiket terkunci kuota saat mencoba menutupnya | tidak gagal diam-diam | – | M1 |
| US-64 | P2 Gating | Builder Free | tahu Slack dan GitHub Issues butuh Indie saat mencoba menghubungkannya | jelas apa yang saya dapat kalau upgrade | S-13 | M3 |
| US-65 | P2 Badge | Builder Indie | widget, email dan banner tanpa "Powered by Saidloop" | app saya terlihat milik saya. **Menunggu keputusan** | S-18 sampai S-23 | M5 |
| US-66 | P2 Badge | User | menemukan Saidloop dari badge di email notifikasi | bisa memakai tool yang sama untuk app saya. **Menunggu keputusan** | S-23 | M5 |
| US-67 | P3 Seat | Builder Indie | tahu berapa seat yang saya punya sebelum mengundang | tidak mentok saat mengundang partner. **Menunggu keputusan** (1 atau 2) | S-14, S-15 | M5 |
| US-68 | Kartu plan | Builder | melihat batas project, laporan dan repo di kartu plan | bisa membandingkan plan dengan jujur | S-01, S-15 | M5 |
| US-69 | Kartu plan | Builder | isi kartu plan sama dengan yang dikunci di produk | tidak merasa ditipu setelah bayar | S-01, S-15 | M5 |

### Kriteria penerimaan

**US-60.** Token MCP yang dibuat di plan apa pun punya scope `read` dan `write`. Panggilan `update_status`, `add_note`, `mark_fixed` dan `reroute_feedback` dari token Free berhasil. Tidak ada lagi `PREMIUM_REQUIRED` untuk tools MCP.

**US-61.** Migrasi menambahkan scope `write` ke semua token Free yang belum dicabut. Migrasi dicatat di audit log per org dan disebut di changelog. Token yang sudah dicabut tidak tersentuh.

**US-62.** `mark_fixed` atau status fixed di project Free mengirim email dan banner in-app ke semua pelapor tiket, mengikuti pengaturan notifikasi project. Isi sama dengan plan berbayar, kecuali badge (US-66).

**US-63.** `mark_fixed`, `update_status` dan `get_feedback_context` pada tiket yang semua laporannya terkunci kuota mengembalikan error `QUOTA_LOCKED` dengan tanggal reset kuota dan tautan upgrade.

**US-64.** Endpoint hubungkan Slack dan GitHub Issues menolak Free dengan `PREMIUM_REQUIRED`. Di S-13 kedua kartu integrasi tampil dengan label Indie dan tombol upgrade, bukan tombol connect yang gagal. Integrasi yang sudah terhubung di org Free sebelum rilis tetap jalan sampai dicabut (atau diputuskan lain).

**US-65.** Menunggu keputusan badge. Bila disetujui: badge tampil di launcher, form lapor, konfirmasi, banner dan email untuk Free; hilang dalam satu menit setelah upgrade ke Indie; muncul lagi saat downgrade ke Free.

**US-66.** Menunggu keputusan badge. Bila disetujui: badge bertaut ke landing dengan parameter UTM per project, dan klik serta pendaftaran dari tautan itu tercatat di PostHog.

**US-67.** Menunggu keputusan seat. S-14 menampilkan "x dari y seat". Saat batas tercapai, undangan baru ditolak dengan teks batas dan tautan upgrade ke Studio. Anggota yang sudah ada sebelum perubahan tidak dikeluarkan.

**US-68.** Kartu Free di S-15 dan S-01: "Widget, inbox, full MCP loop" dan baris sekunder "1 project · 50 reports / mo · 3 repos / project". Kartu lain mengikuti tabel pricing di atas. Repo tidak tampil di baris fitur utama.

**US-69.** Setiap fitur yang disebut di kartu plan punya cek entitlement di backend, dan dicek oleh tes per plan. Tidak ada fitur di kartu yang hanya dibatasi di UI.

## Dampak ke produk

| Tempat | Perubahan |
| --- | --- |
| `entitlements.go` | Tambah `MaxReposPerProject` (3, 5, 10, 0), `BadgeRequired(plan)`, `IntegrationAllowed(plan, provider)`; Indie `MaxSeats: 1` |
| `mcp.go`, `server.go` | Hapus syarat `plan != "free"` untuk scope `write`; migrasi scope token Free yang aktif |
| Handler Slack dan GitHub Issues | Tolak Free dengan `PREMIUM_REQUIRED` |
| Widget, SDK, email, banner | Badge "Powered by Saidloop" untuk Free |
| `Billing.tsx` (Change plan) | Free: "Widget, inbox, full MCP loop"; Indie: "Slack & GitHub Issues, public board, no badge". Baris sekunder ditambah repo, misal "1 project · 50 reports / mo · 3 repos / project" |
| `LandingPage.tsx` | Ganti "MCP read-only tools" di kartu Free; samakan isi kartu dengan tabel di atas |
| PRD MVP | Tidak diubah. Tambahkan satu baris di bagian Pricing yang menunjuk ke dokumen ini setelah disetujui |

## Metrik sukses

Angka usulan awal.

| Metrik | Target | Cara ukur |
| --- | --- | --- |
| Loop tertutup di Free | 40% project Free aktif punya minimal satu `mark_fixed` lewat MCP dalam 30 hari | Event `mark_fixed` per plan |
| Konversi Free ke berbayar | Minimal 5% project Free aktif upgrade dalam 60 hari | Billing |
| Pemicu upgrade | Catat pemicu tiap upgrade: kuota, project, badge, integrasi, seat | Event `upgrade_started` dengan alasan |
| Akuisisi dari badge | Klik "Powered by Saidloop" dan daftar dari tautan itu | PostHog |

## Risiko dan pertanyaan terbuka

| Risiko | Dampak | Penanganan |
| --- | --- | --- |
| **50 laporan per bulan bukan rem untuk target pasar.** Bear Budget punya 6 laporan sejak September. Kebanyakan app indie di awal tidak akan menyentuh 50 per bulan | Free terasa cukup selamanya, konversi rendah | Rem tambahan: badge, 1 project, Slack dan GitHub Issues hanya berbayar. Ukur pemicu upgrade; kalau kuota jarang tersentuh, turunkan ke 25 atau tambahkan batas riwayat (misal laporan lebih dari 90 hari diarsipkan di Free) |
| Free full loop menghilangkan alasan terkuat upgrade di copy lama ("All MCP tools") | Indie terasa tipis di $12 | Indie dijual dari sisi kuota 20 kali lipat, 3 project, integrasi, dan tanpa badge. Uji copy di interview M0 |
| Penyalahgunaan Free lewat banyak akun | Biaya email dan storage | Biaya per laporan kecil; rate limit per key dan per IP sudah ada; batasi 1 org Free per email terverifikasi |
| Badge di email notifikasi bisa terasa mengganggu bagi builder | Builder enggan memasang di app produksi | Badge kecil dan sopan; dihapus cukup dengan Indie |
| Mengubah token lama lewat migrasi | Token Free tiba-tiba punya hak tulis | Wajar, karena ini perluasan hak yang diinginkan; catat di audit log dan changelog |

- [ ] **Seat Indie: 1 atau 2?** Rekomendasi 1 (ubah kode). Kalau 2, kartu plan dan landing harus menyebutnya.
- [ ] Apakah badge "Powered by Saidloop" di Free disetujui? Ini rem tambahan yang saya usulkan sendiri, bukan bagian dari keputusan sebelumnya.
- [ ] Apakah kuota Free tetap 50, atau diturunkan sekarang karena alasan di tabel risiko? Rekomendasi: tetap 50 sampai ada data, putuskan ulang 60 hari setelah beta publik.
- [ ] Angka repo per project (3, 5, 10) masih tebakan; validasi di interview M0.
- [ ] Board publik di Free: tetap terkunci seperti PRD MVP? Rekomendasi: ya, karena board adalah fitur yang terlihat publik dan cocok jadi alasan upgrade.

## Referensi desain

Desain dibaca lewat Pencil MCP dari `closeloop.pen` (cara pakai di [Closeloop User Stories dan Screens](Closeloop%20User%20Stories%20dan%20Screens.md#referensi-desain-closelooppen)). Desain sudah mengikuti dokumen ini, dengan rekomendasi untuk keputusan terbuka (Indie 1 seat, badge di Free, kuota Free 50, board publik di Indie). Kalau keputusan berubah, desain dan dokumen ini perlu diubah bersama. Peta story ada juga di frame `SimGS`.

| Kebutuhan | Frame (node ID) | Catatan |
| --- | --- | --- |
| US-60 Free dapat semua tools MCP | S-05 `HcHA7` (footer "Every plan includes all MCP tools"), S-01 Pricing `BPPVw`, S-06 empty `PN6mj` | Coach mark F5 (`ObRdo`, `KdiK2`, `nMRDS`) masih memakai footer lama, jangan diikuti |
| US-61, US-63 Migrasi token, `QUOTA_LOCKED` | API saja | Tidak ada screen |
| US-62 Notifikasi di Free | S-21 `QkmxJ`, S-23 `cXJSw`, varian badge di S-31 `s67yG` | |
| US-64 Slack dan GitHub Issues butuh Indie | S-13 v2 Free plan limits `dmcSk`, checklist S-06 empty `PN6mj` | |
| Linear dan Jira butuh Studio | S-13 `wAub0`, S-13 v2 `ho9Yy` | Label Studio + "Upgrade to Studio" |
| US-65, US-66 Badge (menunggu keputusan) | S-31 `s67yG` | Launcher, form, sent, banner, email; tautan dengan UTM. Domain di desain belum konsisten (`saidloop.com` vs `saidloop.dev`) |
| US-67 Seat Indie (menunggu keputusan) | S-14 v2 `APr9x`, baris Seats di S-15 `jRMCb` | Abaikan project switcher "Pixel Studio · Studio" di S-14 v2 |
| US-68, US-69 Kartu plan | S-15 Change plan di `jRMCb`, S-01 Pricing `BPPVw` | Baris sekunder "1 project · 50 reports / mo · 3 repos / project · 1 seat" |
