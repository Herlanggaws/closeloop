# Closeloop User Stories dan Screens

Nov 3, 2026 · @Herlangga Wicaksono

Turunan dari PRD Closeloop MVP: user story per fitur, skenario pemakaian utama, dan daftar screen yang perlu didesain.

## User stories

Ada 44 story yang dikelompokkan per fitur PRD. Peran: **Builder** (pemilik app, yang membayar), **User** (pemakai app si builder yang melapor), **Pengunjung** (orang di board publik), **Admin** (admin perusahaan di plan Business), **Agent** (AI coding agent lewat MCP).

| ID | Fitur | Sebagai | Saya ingin | Supaya | Milestone |
| --- | --- | --- | --- | --- | --- |
| US-01 | F1 Akun | Builder | daftar dengan email atau Google | bisa mulai tanpa kartu kredit | M1 |
| US-02 | F1 Akun | Builder | membuat project dan memilih platform app | tiap app punya inbox dan key sendiri | M1 |
| US-03 | F1 Akun | Builder | menyalin public key dan snippet pasang | widget atau SDK jalan dalam 5 menit | M1 |
| US-04 | F1 Akun | Builder | membuat, mengganti, dan mencabut token MCP | akses agent bisa saya kontrol | M1 |
| US-05 | F1 Akun | Builder | mengundang anggota tim dengan role | tim kecil bisa memilah laporan bersama | M1 |
| US-06 | F2 Widget | User | membuka form lapor dari tombol di layar mana pun | melapor tanpa pindah aplikasi | M1 |
| US-07 | F2 Widget | User | memilih tipe bug, ide, atau pertanyaan | laporan saya masuk ke tempat yang tepat | M1 |
| US-08 | F2 Widget | User | melampirkan screenshot otomatis dan mencoretnya | builder lihat persis masalahnya | M1 |
| US-09 | F2 Widget | User | melihat konfirmasi setelah kirim | yakin laporan saya diterima | M1 |
| US-10 | F2 Widget | Builder | menandai elemen sensitif agar diblur | data pribadi user tidak ikut terkirim | M1 |
| US-11 | F2 Widget | Builder | mengirim user id dan versi app lewat identify | laporan bisa dikaitkan ke akun dan rilis | M1 |
| US-12 | F3 SDK | User | goyang HP untuk membuka form lapor | lapor cepat di app mobile | M2 |
| US-13 | F3 SDK | User | laporan tetap terkirim walau sedang offline | laporan tidak hilang | M2 |
| US-14 | F3 SDK | Builder | memasang SDK Android dan iOS dengan satu dependency | dukungan mobile sama dengan web | M2 |
| US-15 | F4 Inbox | Builder | melihat semua laporan dengan filter tipe, status, platform | tahu mana yang perlu dikerjakan | M1 |
| US-16 | F4 Inbox | Builder | membuka detail laporan dengan screenshot dan konteks | bisa reproduksi masalah | M1 |
| US-17 | F4 Inbox | Builder | mengubah status dan menulis catatan internal | progres tercatat | M1 |
| US-18 | F4 Inbox | Builder | menggabungkan laporan duplikat | satu tiket mewakili semua pelapor | M1 |
| US-19 | F4 Inbox | Builder | melihat error Sentry dan sesi PostHog terkait | punya konteks teknis tanpa mencari | M1 |
| US-20 | F5 MCP | Builder | memasang MCP di Cursor atau Claude Code dengan satu langkah | agent bisa membaca laporan | M1 |
| US-21 | F5 MCP | Agent | mengambil daftar laporan terbuka | tahu apa yang harus diperbaiki | M1 |
| US-22 | F5 MCP | Agent | mengambil konteks lengkap satu laporan | bisa menemukan root cause | M1 |
| US-23 | F5 MCP | Agent | mengubah status, menambah catatan, dan menandai fixed | tiket tertutup tanpa builder membuka dashboard | M1 |
| US-24 | F6 Kabar | User | menerima email atau banner saat laporan saya beres | tahu masukan saya didengar | M1 |
| US-25 | F6 Kabar | Builder | menulis catatan rilis singkat yang ikut terkirim | user paham apa yang berubah | M1 |
| US-26 | F6 Kabar | Builder | mematikan notifikasi per project | kontrol komunikasi ke user | M1 |
| US-27 | F7 Wrapper | Builder | memasang paket Flutter atau React Native | tidak perlu menulis kode native | M2 |
| US-28 | F7 Wrapper | Builder | memakai Expo tanpa eject | setup tetap sederhana | M2 |
| US-29 | F8 Integrasi | Builder | menerima laporan baru di channel Slack | tim tahu saat itu juga | M3 |
| US-30 | F8 Integrasi | Builder | membuat issue GitHub, Linear, atau Jira dari tiket | kerja tetap di tool yang biasa dipakai | M3 |
| US-31 | F8 Integrasi | Builder | status tiket ikut berubah saat issue ditutup | pelapor tetap dikabari | M3 |
| US-32 | F9 Board | Builder | memilih laporan mana yang tampil di board publik | data privat tidak bocor | M3 |
| US-33 | F9 Board | Pengunjung | melihat ide dan roadmap lalu memberi vote | ikut menentukan prioritas | M3 |
| US-34 | F9 Board | Pengunjung | dikabari saat ide yang saya vote dirilis | tahu suara saya berdampak | M3 |
| US-35 | F10 Auto PR | Builder | menghubungkan repo lewat GitHub App | agent bisa membuat PR | M4 |
| US-36 | F10 Auto PR | Builder | menjalankan auto PR dari satu tiket atau aturan label | bug kecil beres tanpa sesi agent | M4 |
| US-37 | F10 Auto PR | Builder | melihat status run, biaya, dan link PR di tiket | bisa menilai hasil sebelum merge | M4 |
| US-38 | F10 Auto PR | Builder | membeli dan memantau kredit | biaya terkendali | M4 |
| US-39 | F11 Replay | Builder | memutar ulang sesi sebelum laporan dikirim | lihat langkah yang memicu bug | M3 |
| US-40 | F11 Replay | Builder | input sensitif dimasking otomatis | replay aman dari data pribadi | M3 |
| US-41 | F12 Business | Admin | login tim lewat SSO SAML atau OIDC | akses mengikuti aturan perusahaan | M4 |
| US-42 | F12 Business | Admin | melihat dan mengekspor audit log | kebutuhan audit terpenuhi | M4 |
| US-43 | F12 Business | Admin | memasang Closeloop di server sendiri | data tidak keluar dari infrastruktur kami | M4 |
| US-44 | Billing | Builder | upgrade, downgrade, dan melihat pemakaian kuota | bayar sesuai kebutuhan | M5 |

## User scenarios

Delapan skenario ini menutup semua story di atas. Kode S-xx merujuk ke daftar screen di bagian berikutnya.

### SC-1. Builder memasang Closeloop di app web pertama kali

Herlangga mau memindahkan feedback Bear Budget web dari SSH + psql ke Closeloop.

1. Buka landing (S-01), klik Join the waitlist lalu daftar dengan Google (S-02).
2. Buat project "Bear Budget Web", pilih platform Web (S-03).
3. Salin snippet script dan tambahkan `identify` dengan user id dan versi app (S-04).
4. Halaman pasang menunggu laporan percobaan; begitu masuk, centang hijau muncul.
5. Buat token MCP dan salin config untuk Claude Code (S-05). Agent berhasil memanggil `list_open_feedback`.
6. Masuk ke inbox kosong dengan panduan langkah berikutnya (S-06).

Story: US-01 sampai US-04, US-11, US-20.

### SC-2. User melapor bug, AI memperbaiki, user dikabari

Rina, pengguna Bear Budget, menemukan filter transaksi tidak refresh.

1. Rina klik tombol Lapor di pojok layar (S-18).
2. Form terbuka dengan screenshot otomatis; saldo sudah diblur karena ditandai sensitif. Rina pilih Bug, menulis pesan, mencoret area filter, isi email (S-19).
3. Rina melihat konfirmasi "Laporan terkirim" (S-20).
4. Laporan muncul di inbox Herlangga dengan label Bug, Web, Safari (S-06).
5. Di Claude Code, Herlangga minta "fix bug terbaru dari user". Agent memanggil `list_open_feedback` lalu `get_feedback_context`, menemukan root cause, dan mengedit kode.
6. Setelah deploy, agent memanggil `mark_fixed` dengan catatan "Filter sekarang refresh dengan benar".
7. Rina menerima email (S-23) dan, saat membuka Bear Budget lagi, banner "Laporan kamu sudah dibereskan" (S-21).

Story: US-06 sampai US-10, US-15, US-16, US-21 sampai US-25.

### SC-3. User mobile melapor saat offline

1. Dimas memakai Bear Budget Android di kereta tanpa sinyal dan menemukan tombol simpan tidak merespons.
2. Dimas goyang HP; sheet lapor native terbuka dengan screenshot layar aktif (S-22).
3. Dimas mengirim laporan; sheet bilang laporan akan dikirim saat online.
4. Saat sinyal kembali, SDK mengirim laporan dari antrean. Laporan tiba di inbox dengan model device, versi OS, dan build (S-06, S-07).

Story: US-12 sampai US-14, juga US-27 dan US-28 untuk app Flutter atau React Native.

### SC-4. Builder memilah dan menggabungkan laporan

1. Herlangga membuka inbox, memfilter Bug dan Open (S-06).
2. Tiga laporan menyebut hal yang sama. Ia memilih ketiganya dan menggabungkannya ke satu tiket induk (S-08).
3. Di detail tiket (S-07) ia melihat error Sentry terkait dan sesi PostHog, lalu memutar session replay 2 menit sebelum laporan.
4. Ia mengubah status ke In progress dan menulis catatan internal.

Story: US-15 sampai US-19, US-39, US-40.

### SC-5. Builder memakai AI auto PR

1. Di pengaturan integrasi, Herlangga menghubungkan repo Bear Budget lewat GitHub App (S-13).
2. Di detail tiket bug kecil (S-07), ia klik Jalankan auto PR. Satu kredit terpakai.
3. Halaman auto PR runs (S-10) menampilkan run berjalan, lalu selesai dengan link PR, ringkasan root cause, dan biaya.
4. Herlangga me-review dan merge PR di GitHub. Tiket otomatis jadi Fixed dan modal kabar terbuka (S-09) untuk catatan rilis.
5. Kredit menipis; ia membeli kredit tambahan (S-15).

Story: US-35 sampai US-38, US-44.

### SC-6. Tim kecil bekerja dari Slack dan Linear

1. Studio dua orang menghubungkan Slack dan Linear (S-13) dan mengundang anggota kedua (S-14).
2. Laporan baru masuk ke channel #feedback.
3. Dari tiket, mereka membuat issue Linear (S-07).
4. Saat issue Linear ditutup, tiket Closeloop berubah Fixed dan pelapor dikabari.

Story: US-05, US-29 sampai US-31.

### SC-7. Pengunjung memberi vote di board publik

1. Herlangga memilih ide "Ekspor ke Google Sheets" untuk tampil di board publik dan mengatur domain board (S-11, S-12).
2. Pengunjung membuka board (S-24), membaca detail ide (S-25), dan memberi vote dengan email yang diverifikasi (S-27).
3. Ide naik ke kolom Planned lalu Released di roadmap (S-26).
4. Semua pemberi vote menerima email bahwa ide sudah rilis (S-27).

Story: US-32 sampai US-34.

### SC-8. Admin perusahaan menyiapkan plan Business

1. Admin upgrade ke Business (S-15).
2. Admin mengatur SSO OIDC dan memaksa login lewat SSO untuk semua anggota (S-16).
3. Tim IT memasang image self-host dan mengaktifkan lisensi (S-17).
4. Sebulan kemudian admin mengekspor audit log aksi MCP dan auto PR (S-16).

Story: US-41 sampai US-43.

## Daftar screen

Total 27 screen. Dashboard dan pengaturan builder adalah bagian terbesar (15 screen termasuk onboarding); widget, SDK, email, dan board publik dilihat user akhir dan pengunjung.

| ID | Screen | Area | Isi utama | Story | Milestone |
| --- | --- | --- | --- | --- | --- |
| S-01 | Landing page | Marketing | Hero, cara kerja, platform, pricing, waitlist | US-01 | M0 |
| S-02 | Daftar dan login | Onboarding | Email, Google, lupa password, SSO bila diaktifkan | US-01, US-41 | M1 |
| S-03 | Buat project | Onboarding | Nama project, pilih platform (Web, Android, iOS, Flutter, React Native) | US-02 | M1 |
| S-04 | Pasang widget atau SDK | Onboarding | Snippet per platform, contoh `identify` dan masking, status laporan pertama | US-03, US-10, US-11, US-14, US-27, US-28 | M1 |
| S-05 | Pasang MCP | Onboarding | Buat token, config Cursor dan Claude Code siap salin, tes koneksi | US-04, US-20 | M1 |
| S-06 | Inbox | Dashboard | Daftar laporan, filter tipe, status, platform, pilih banyak, empty state | US-15 | M1 |
| S-07 | Detail laporan | Dashboard | Pesan, screenshot, konteks device, replay, Sentry, PostHog, status, catatan, buat issue, jalankan auto PR | US-16, US-17, US-19, US-30, US-36, US-39 | M1 |
| S-08 | Gabung duplikat (modal) | Dashboard | Pilih tiket induk, jumlah pelapor | US-18 | M1 |
| S-09 | Tandai fixed dan kabari (modal) | Dashboard | Catatan rilis, pratinjau email dan banner, jumlah penerima | US-24, US-25 | M1 |
| S-10 | Auto PR runs | Dashboard | Daftar run, status, biaya, link PR, log ringkas | US-37 | M4 |
| S-11 | Kelola board publik | Dashboard | Pilih laporan publik, kolom roadmap, moderasi komentar | US-32 | M3 |
| S-12 | Pengaturan project | Settings | Public key, elemen sensitif, notifikasi, domain board | US-10, US-26 | M1 |
| S-13 | Integrasi | Settings | Slack, GitHub (App dan Issues), Linear, Jira, Sentry, PostHog | US-29 sampai US-31, US-35 | M3 |
| S-14 | Tim dan role | Settings | Undang anggota, role owner, member, viewer | US-05 | M1 |
| S-15 | Billing dan kredit | Settings | Plan saat ini, kuota terpakai, upgrade, beli kredit auto PR, invoice | US-38, US-44 | M5 |
| S-16 | SSO dan audit log | Settings (Business) | Konfigurasi SAML/OIDC, paksa SSO, tabel audit log, ekspor | US-41, US-42 | M4 |
| S-17 | Aktivasi lisensi self-host | Self-host | Masukkan kunci lisensi, status versi, info update | US-43 | M4 |
| S-18 | Tombol lapor (launcher) | Widget web | Tombol mengambang, posisi dan warna dari pengaturan | US-06 | M1 |
| S-19 | Form lapor | Widget web | Tipe, pesan, screenshot dengan coretan, email opsional | US-07, US-08 | M1 |
| S-20 | Konfirmasi terkirim | Widget web | Pesan sukses, nomor laporan | US-09 | M1 |
| S-21 | Banner sudah dibereskan | Widget web dan SDK | Catatan dari builder, tutup banner | US-24 | M1 |
| S-22 | Sheet lapor mobile | SDK Android dan iOS | Sheet native, screenshot dengan coretan, status antrean offline | US-12, US-13 | M2 |
| S-23 | Email sudah dibereskan | Email | Ringkasan laporan, catatan rilis, link ke app | US-24, US-25 | M1 |
| S-24 | Board publik: daftar ide | Board publik | Ide dengan jumlah vote, filter status, tombol ajukan ide | US-33 | M3 |
| S-25 | Board publik: detail ide | Board publik | Deskripsi, vote, komentar, status | US-33 | M3 |
| S-26 | Board publik: roadmap | Board publik | Kolom Planned, In progress, Released | US-33 | M3 |
| S-27 | Email vote | Email | Verifikasi email pemberi vote, kabar ide dirilis | US-34 | M3 |

## Peta screen

&#91;embedded content: peta screen dashboard builder · 15 screen\]

Onboarding dilewati sekali, lalu builder bolak-balik antara inbox dan detail laporan. Screen user akhir (S-18 sampai S-23), board publik (S-24 sampai S-27), landing, dan lisensi self-host berdiri sendiri di luar dashboard.
