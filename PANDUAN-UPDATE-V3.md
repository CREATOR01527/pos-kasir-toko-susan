# Panduan Update v3 — Pajak, WhatsApp, Notifikasi Telegram, Multi-Cabang

## 1. Jalankan migrasi SQL (WAJIB, urut, di Supabase SQL Editor)

1. `supabase/migration-09-pajak.sql`
2. `supabase/migration-10-notifikasi.sql`
3. `supabase/migration-11-cabang.sql`

(Kalau sebelumnya migration-08-pengaturan-struk.sql belum pernah dijalankan —
itu penyebab error "Could not find receipt_show_address column" — jalankan itu
dulu sebelum yang di atas.)

Semua migrasi ini aman dijalankan di database yang sudah ada isinya (pakai
`add column if not exists`), tidak menghapus data.

## 2. Deploy kode baru ke Vercel

Upload/replace project seperti biasa (lihat README.md bagian Deploy). Tidak ada
environment variable baru yang wajib — CRON_SECRET yang sudah ada dipakai lagi
untuk 2 jadwal cron baru di `vercel.json`.

## 3. Aktifkan fitur satu per satu

- **Pajak/PPN**: buka menu Produk & Harga → edit produk yang kena pajak → isi
  field "Pajak/PPN (%)". Kalau perlu label custom atau harga sudah termasuk
  pajak, atur di Pengaturan Toko.
- **Kirim struk WhatsApp**: langsung aktif, tidak perlu setup apa pun. Tombol
  "Kirim WhatsApp" muncul di modal struk setelah transaksi.
- **Notifikasi Telegram**:
  1. Chat `@BotFather` di Telegram → `/newbot` → catat Bot Token.
  2. Chat `@userinfobot` → catat Chat ID Anda (atau tambahkan bot ke grup toko
     dan pakai Chat ID grup itu).
  3. Buka Pengaturan Toko → Notifikasi Otomatis → isi Bot Token & Chat ID →
     Simpan Pengaturan.
  4. Klik "Tes Kirim: Stok Menipis" / "Tes Kirim: Laporan Harian" untuk
     memastikan pesan masuk ke Telegram.
  5. Nyalakan toggle yang diinginkan.
- **Multi-Cabang**: menu Cabang (sidebar admin) sudah otomatis berisi "Cabang
  Utama" dari data toko lama. Tambah cabang baru kalau perlu, lalu tugaskan
  akun kasir ke cabang masing-masing di menu Pengguna.

## 4. Sudah dicek

Kode ini sudah di-build (`next build`) tanpa error sebelum dikirim. Yang
BELUM bisa dicek dari sisi kami: koneksi nyata ke database Supabase Anda
(karena kami tidak mengakses project Supabase Anda) — jadi tetap uji coba
transaksi & fitur baru di aplikasi setelah migrasi & deploy selesai.
