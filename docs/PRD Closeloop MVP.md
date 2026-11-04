# PRD Closeloop MVP

Nov 3, 2026 · @Herlangga Wicaksono

## Ringkasan

Closeloop (nama sementara) adalah SaaS feedback dan tiket untuk solo/indie app builder yang ngoding bareng AI. User akhir lapor bug atau ide dari dalam app (web, Android, iOS) lengkap dengan screenshot dan konteks. AI coding agent builder (Cursor, Claude Code) membaca laporan itu lewat MCP, memperbaikinya, lalu menandai selesai, dan Closeloop otomatis mengabari user yang melapor.

Target pasar global dengan harga USD. Bear Budget jadi user pertama (dogfooding) sebelum dibuka ke builder lain.

Landing draft: [Closeloop Landing Draft](https://claude.ai/artifact/B9MkdBnjBDpBth5icwBdGk).

## Masalah

Builder yang ngoding pakai AI bisa fix bug dalam menit, tapi jalur dari laporan user ke AI masih manual dan putus. Di Bear Budget alurnya hari ini begini:

1. User kirim feedback lewat form in-app (tabel `user_feedbacks`), tanpa screenshot. Request upload screenshot (feedback id 3) masih open.
2. Builder narik data dari DB prod lewat SSH + `psql`, lalu menyalinnya ke `doc/feedback.md`.
3. Laporan ditempel ke Cursor/Claude, AI cari root cause dan fix (F1, F3 sampai F7 selesai dengan cara ini).
4. Status diupdate manual di `backlog.md`. User yang melapor tidak dikabari kalau bug-nya sudah beres.

Akibatnya: konteks hilang (device, versi app, error terkait), waktu habis di copy-paste, dan user awal tidak merasa didengar. Tool feedback yang ada (Canny, Featurebase, Userback) berhenti di board dan tidak dirancang untuk dibaca AI agent.

## Target user

User utama adalah builder yang membayar; user kedua adalah orang yang memakai app mereka dan mengirim laporan.

| Persona | Siapa | Yang dia butuhkan |
| --- | --- | --- |
| Solo builder (utama) | 1 sampai 3 orang, punya app web atau mobile dengan user nyata, ngoding pakai Cursor atau Claude Code | Laporan yang langsung bisa dikerjakan AI, satu inbox, user dikabari otomatis |
| Studio kecil | Tim 2 sampai 5 orang yang pegang beberapa app klien | Banyak project, seat tim, widget dengan branding sendiri |
| User akhir | Orang yang memakai app si builder | Lapor cepat dari layar yang bermasalah, tahu laporannya diproses dan sudah beres |

Platform app builder yang didukung: web dulu, lalu Android dan iOS native, lalu Flutter dan React Native.

## Tujuan dan metrik sukses

MVP dianggap berhasil kalau dalam 90 hari setelah beta publik ada 10 builder yang membayar, selain Bear Budget. Angka target di bawah ini usulan awal dan perlu disepakati.

| Metrik | Target | Cara ukur |
| --- | --- | --- |
| Validasi interview | 3 dari 10 builder bilang "mau coba minggu ini" | Log interview |
| Waitlist | 100 email sebelum beta | Form waitlist |
| Aktivasi | 60% project baru menerima laporan pertama dalam 7 hari | PostHog |
| Loop tertutup | 50% laporan bug ditandai fixed lewat MCP | Event `mark_fixed` |
| Waktu ke fix | Median di bawah 48 jam dari laporan masuk ke fixed | Timestamp tiket |
| Konversi berbayar | 10 builder di plan Indie atau Studio | Billing |
| Dogfooding | 100% feedback Bear Budget lewat Closeloop, tanpa SSH + psql | Bear Budget |

## Scope MVP

MVP berisi dua belas fitur. F1 sampai F6 adalah inti loop feedback, F7 sampai F12 memperluasnya ke framework mobile lain, tool tim, AI otomatis, dan kebutuhan perusahaan. Semuanya berjalan di atas satu API publik, jadi widget, SDK, dashboard, MCP dan integrasi memakai kontrak yang sama.

### F1. Akun dan project

Sebagai builder, saya bisa daftar, bikin project, dan dapat project key untuk dipasang di app saya.

- Daftar dan login pakai email atau Google.
- Satu akun bisa punya beberapa project sesuai plan.
- Tiap project punya public key (hanya boleh membuat laporan) dan secret token MCP terpisah.
- Token MCP disimpan sebagai hash, ditampilkan sekali saat dibuat, bisa diganti dan dicabut (pola sama dengan MCP Bear Budget C10).

### F2. Web widget

Sebagai user akhir, saya bisa kirim bug atau ide dari layar mana pun di app web, lengkap dengan screenshot.

- Dipasang dengan satu script tag atau paket npm, kurang dari 5 menit.
- Form: tipe (bug, ide, pertanyaan), pesan, screenshot otomatis dan upload manual, email opsional.
- Konteks otomatis: URL dan route, browser, OS, ukuran layar, versi app, user id dari builder, waktu.
- Builder bisa menandai elemen sensitif agar diblur sebelum screenshot dikirim.
- User melihat konfirmasi setelah laporan terkirim.

### F3. SDK Android dan iOS

Sebagai mobile builder, saya bisa memasang hal yang sama di app Android dan iOS.

- Android: library Kotlin di Maven Central. iOS: Swift Package.
- Trigger lewat goyang HP atau panggilan `Closeloop.show()`.
- Screenshot otomatis dari layar aktif, dengan masking view sensitif.
- Konteks: model device, versi OS, versi app dan build, locale, user id.
- Antrean offline: laporan dikirim ulang saat koneksi kembali.
- Diuji pertama di app Bear Budget (Kotlin Multiplatform).

### F4. Inbox dan tiket

Sebagai builder, saya bisa melihat, memilah, dan mengubah status semua laporan di satu tempat.

- Daftar laporan dengan filter tipe, status, platform, project.
- Status: open, in progress, fixed, won't fix, duplicate.
- Detail laporan: pesan, screenshot, konteks, riwayat status, catatan internal.
- Gabung laporan duplikat; jumlah pelapor terlihat di tiket induk.
- Tautan opsional ke Sentry issue dan PostHog session bila integrasi aktif.

### F5. MCP server

Sebagai builder, saya bisa menyuruh AI agent saya membaca dan menutup laporan tanpa copy-paste.

- Endpoint remote MCP (JSON-RPC 2.0) dengan token per project.
- Tools: `list_open_feedback`, `get_feedback_context`, `update_status`, `add_note`, `mark_fixed`.
- `get_feedback_context` mengembalikan pesan, konteks lengkap, URL screenshot, dan data Sentry atau PostHog terkait.
- Plan Free hanya dapat tools baca; plan berbayar dapat semua tools.
- Panduan pasang satu langkah untuk Cursor dan Claude Code.

### F6. Kabar ke pelapor

Sebagai user akhir, saya diberi tahu saat laporan saya sudah dibereskan.

- `mark_fixed` atau ubah status ke fixed di dashboard memicu notifikasi ke semua pelapor tiket itu.
- Lewat email bila pelapor mengisi email, dan lewat banner in-app (widget atau SDK) saat app dibuka lagi.
- Builder bisa menulis catatan singkat yang ikut dikirim, dan bisa mematikan notifikasi per project.

### F7. Wrapper Flutter dan React Native

Sebagai builder Flutter atau React Native, saya bisa memasang Closeloop tanpa menulis kode native.

- Paket Flutter di pub.dev dan paket React Native di npm (termasuk dukungan Expo), membungkus SDK Android dan iOS.
- API sama dengan SDK native: `show()`, identify user, masking widget sensitif, antrean offline.
- Contoh app untuk masing-masing framework.

### F8. Integrasi Slack, GitHub Issues, Linear, Jira

Sebagai builder atau tim kecil, saya bisa meneruskan laporan ke tool yang sudah saya pakai.

- Slack: notifikasi laporan baru dan perubahan status ke channel pilihan.
- GitHub Issues, Linear, Jira: buat issue dari tiket dengan satu klik atau otomatis per tipe laporan.
- Sinkron dua arah untuk status: issue ditutup di tool lain, tiket Closeloop jadi fixed dan pelapor dikabari.

### F9. Board publik dan voting fitur

Sebagai user akhir, saya bisa melihat ide yang sudah diajukan, memberi vote, dan mengikuti statusnya.

- Halaman publik per project (subdomain atau domain sendiri) berisi ide dan roadmap.
- Builder memilih laporan mana yang tampil publik; bug dan data pribadi tidak tampil kecuali dipilih.
- Vote dan komentar butuh email; pemberi vote ikut dikabari saat ide dirilis.

### F10. AI auto pull request

Sebagai builder, saya bisa membiarkan AI membuat pull request untuk laporan tertentu tanpa saya membuka sesi agent.

- Builder menghubungkan repo lewat GitHub App dengan izin minimum (baca kode, buat branch dan PR).
- Dari tiket atau aturan otomatis (misal semua bug dengan label tertentu), agent berjalan di sandbox terisolasi dan membuka PR berisi fix, ringkasan root cause, dan tautan ke tiket.
- Agent tidak pernah merge; builder tetap me-review dan merge sendiri.
- Dibayar per kredit sebagai add-on; tiap run mencatat biaya dan hasilnya di tiket.

### F11. Session replay

Sebagai builder, saya bisa melihat apa yang dilakukan user sebelum melapor.

- Rekaman sesi web berbasis DOM (bukan video) untuk beberapa menit terakhir sebelum laporan dikirim, menempel di tiket.
- Input teks dan elemen bertanda sensitif dimasking secara default.
- Retensi replay mengikuti plan; tautan ke PostHog tetap tersedia bagi yang sudah memakainya.

### F12. SSO, audit log, self-hosting

Sebagai perusahaan, saya bisa memakai Closeloop sesuai aturan keamanan internal.

- SSO lewat SAML dan OIDC, dengan provisioning user dasar.
- Audit log untuk login, perubahan role, ekspor data, dan semua aksi MCP serta auto PR, bisa diekspor.
- Self-hosting lewat image Docker dan Helm chart dengan lisensi tahunan.
- Hanya tersedia di plan Business.

## Di luar scope MVP

Hanya social media management (ide 2) yang ditunda. Semua fitur lain masuk MVP pertama.

Karena scope besar, pengerjaan tetap dipecah ke milestone internal (lihat Rilis bertahap), tapi beta publik baru dibuka setelah dua belas fitur selesai.

## Alur utama

&#91;embedded content: alur utama · 6 langkah, 1 loop balik\]

Satu laporan berjalan dari user ke AI agent dan kembali ke user. Langkah yang di-highlight, `mark_fixed`, adalah pembeda Closeloop dari tool feedback lain.

## Pricing dan billing

Harga dalam USD, dibayar lewat merchant of record (Lemon Squeezy atau Paddle) karena Doit hanya rupiah dan Stripe tidak bisa langsung untuk akun Indonesia.

| Plan | Harga | Project | Laporan per bulan | Isi utama |
| --- | --- | --- | --- | --- |
| Free | $0 | 1 | 50 | Widget dan SDK, inbox, MCP baca saja |
| Indie | $12 / bulan | 3 | 1.000 | Semua tools MCP, notifikasi pelapor, board publik, Slack dan GitHub Issues |
| Studio | $39 / bulan | Tanpa batas | 10.000 | Hingga 5 seat, branding sendiri, Linear dan Jira, session replay 7 hari |
| Business | Mulai $149 / bulan | Tanpa batas | Sesuai kontrak | SSO, audit log, session replay 30 hari, opsi self-hosting dengan lisensi tahunan |
| Add-on AI auto PR | Per kredit | Semua plan berbayar | Sesuai kredit | Satu kredit = satu run agent; harga ditentukan setelah biaya model per run diukur |

- Tahunan: bayar 10 bulan, dapat 12.
- Early access: 50 builder pertama dapat Indie gratis 3 bulan sebagai ganti feedback.
- Lewat kuota: laporan tetap diterima, tapi baru bisa dibaca setelah upgrade atau bulan berganti (data tidak hilang).
- Entitlement memakai pola `IsPro()` dan `PREMIUM_REQUIRED` dari Bear Budget.

## Kebutuhan non-fungsional

Karena laporan bisa berisi data pribadi user akhir, keamanan dan privasi jadi syarat rilis, bukan polesan.

- **Keamanan:** public key hanya bisa membuat laporan, dengan rate limit per key dan per IP. Token MCP di-hash SHA-256 dan ditolak di API dashboard. Session JWT ditolak di endpoint MCP.
- **Privasi:** masking elemen sensitif terjadi di sisi klien sebelum screenshot atau replay dikirim. Email pelapor opsional. Builder bisa menghapus laporan dan semua lampirannya.
- **Penyimpanan:** screenshot dan replay di object storage dengan URL bertanda tangan yang kedaluwarsa. Laporan dan lampiran dihapus permanen 30 hari setelah project dihapus.
- **AI auto PR:** GitHub App dengan izin minimum, token repo tidak pernah keluar dari sandbox, tiap run terisolasi dan dibatasi waktu serta biaya, agent tidak bisa merge.
- **Integrasi:** token OAuth Slack, GitHub, Linear, Jira dienkripsi saat disimpan dan bisa dicabut builder kapan saja.
- **Performa:** kirim laporan di bawah 2 detik pada koneksi 4G. Script widget di bawah 30 KB gzip, modul replay dimuat terpisah. SDK mobile tidak menambah waktu startup app secara terukur.
- **Ketersediaan:** API menerima laporan 99,5% per bulan; SDK mengantre saat API tidak bisa dihubungi.
- **Self-hosting:** satu image Docker plus Postgres dan object storage S3-compatible; versi self-host mengikuti rilis cloud paling lambat 30 hari.
- **Observability:** Sentry untuk error API dan dashboard, PostHog untuk funnel aktivasi (pola O1 dan O2 Bear Budget).
- **Kepatuhan:** kebijakan privasi dan DPA sederhana untuk builder di luar Indonesia (GDPR dasar).

## Kompetitor dan diferensiasi

Beda Closeloop ada di gabungan tiga hal yang belum ada di satu tool: laporan siap dibaca AI, MCP yang bisa menutup tiket, dan kabar otomatis ke pelapor. Peta di bawah dari pengetahuan umum, belum dicek ulang ke situs masing-masing.

| Tool | Fokus | Celah untuk Closeloop |
| --- | --- | --- |
| Canny, Featurebase | Board ide dan voting, roadmap | Tidak dirancang untuk dibaca AI agent, lemah di bug report dengan konteks |
| Userback, Marker.io | Bug report visual dari web | Fokus tim QA dan agensi, harga per seat, mobile terbatas |
| Jam.dev | Bug report dengan replay, sudah punya MCP | Diarahkan ke tim internal, bukan laporan dari user akhir |
| Sentry User Feedback | Feedback menempel ke error | Kuat untuk crash, kurang untuk ide dan pertanyaan, tidak mengabari pelapor |
| Instabug | SDK mobile lengkap | Mahal dan berat untuk solo builder |

Posisi: tool paling murah dan paling cepat dipasang untuk builder yang sudah ngoding pakai AI, di web dan mobile.

## Rilis bertahap

Semua fitur masuk MVP, jadi pengerjaannya dipecah ke milestone internal dan beta publik dibuka di akhir. Tanggal belum ditentukan.

1. **M0, validasi:** landing live dengan waitlist, interview 5 sampai 10 builder. Lolos kalau 3 dari 10 mau coba minggu ini.
2. **M1, inti web (F1, F2, F4, F5, F6):** API, web widget, inbox, MCP, kabar ke pelapor. Dipasang di Bear Budget web dan menggantikan alur SSH + psql. Lolos kalau semua feedback Bear Budget masuk lewat Closeloop selama 2 minggu.
3. **M2, mobile (F3, F7):** SDK Android dan iOS diuji di Bear Budget, lalu wrapper Flutter dan React Native dengan contoh app. Lolos kalau laporan dari keempat platform tiba lengkap dengan screenshot dan konteks.
4. **M3, tool tim dan publik (F8, F9, F11):** integrasi Slack, GitHub Issues, Linear, Jira, board publik, session replay. Lolos kalau 3 beta builder memakai minimal satu integrasi.
5. **M4, AI dan Business (F10, F12):** AI auto PR di repo Bear Budget dulu, lalu SSO, audit log, image self-host. Lolos kalau auto PR menghasilkan 5 PR yang di-merge di Bear Budget.
6. **M5, beta publik:** buka untuk waitlist dengan semua plan dan billing USD aktif. Target: 10 builder berbayar dalam 90 hari.

## Risiko dan pertanyaan terbuka

| Risiko | Dampak | Penanganan |
| --- | --- | --- |
| Scope MVP dua belas fitur untuk satu orang | Beta publik molor berbulan-bulan, kompetitor bergerak duluan | Undang beta builder sejak M1 tanpa menunggu beta publik; pakai AI agent untuk SDK dan integrasi |
| Sentry, Jam.dev atau Canny menambah MCP yang setara | Diferensiasi menipis | Fokus ke loop tertutup dan harga solo builder |
| Builder tidak mau bayar untuk feedback tool | Revenue lambat | Validasi harga di interview sebelum build banyak |
| Screenshot atau replay membocorkan data sensitif user akhir | Kepercayaan dan hukum | Masking di klien sejak hari pertama, retensi terbatas |
| AI auto PR merusak kode atau biaya model membengkak | Kepercayaan builder dan margin | Agent tidak bisa merge, batas biaya per run, uji di Bear Budget dulu |
| Self-hosting menambah beban support | Waktu habis untuk satu dua pelanggan | Hanya untuk plan Business dengan lisensi tahunan |
| Volume laporan Bear Budget kecil (6 baris sejak September) | Dogfooding kurang menguji skala | Tambah 3 sampai 5 beta builder di M1 |

- [ ] Nama final dan domain (Closeloop masih nama sementara).
- [ ] Lemon Squeezy atau Paddle?
- [ ] Boleh pakai backend Go Bear Budget sebagai basis repo baru, atau mulai repo bersih?
- [ ] Siapa 5 sampai 10 builder yang bisa diinterview?
- [ ] Berapa jam per minggu yang tersedia untuk proyek ini?
