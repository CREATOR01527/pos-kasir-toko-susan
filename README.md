# Aplikasi POS Kasir Toko

Aplikasi kasir & manajemen toko berbasis **Next.js + Tailwind CSS + Supabase**.
Dua peran: **Admin** (akses penuh) dan **Kasir** (hanya halaman kasir).

## Fitur

- Ganti jenis penjualan (eceran/grosir/½ grosir/kg dst.) langsung dari baris keranjang,
  tanpa perlu hapus dan tambah ulang barangnya.
- Harga beli (modal) terpisah untuk tiap tingkatan (eceran/grosir/setengah grosir/kiloan),
  supaya laba dihitung dari modal yang benar-benar sesuai, bukan disamaratakan.
- Tambah produk sekarang mulai dari pilih jenis dulu: **Produk PCS** (eceran/grosir/
  setengah grosir) atau **Produk Timbang** (per Kg/1-2 Kg/Ons, tanpa harga eceran).
- Pesanan Pembelian bisa memilih tingkatan harga yang dibeli dari supplier — saat barang
  diterima, harga modal produk (di tingkatan yang sesuai) ikut diperbarui otomatis.
- Form Pesanan Pembelian menampilkan semua tingkatan harga sebagai kolom terpisah
  (bukan dropdown) — isi grosir/setengah grosir otomatis diambil dari data produk,
  dan tiap tingkatan punya kolom Harga Lama (pembanding) & Harga Baru (opsional,
  kosongkan kalau harga dari supplier tidak berubah) untuk harga beli maupun jual.
- Admin bisa membuka layar kasir atas nama akun kasir manapun lewat menu **Buka Kasir**.
- Laba bersih harian & laporan hutang ke supplier (status LUNAS-Transfer/LUNAS-Cash) di Dashboard.
- Validasi mencegah transaksi merugikan: jual melebihi stok, pembayaran kurang, harga jual
  di bawah modal, koreksi stok melebihi stok tersedia, pembayaran kasbon/hutang supplier
  melebihi sisa tagihan, dan kasbon melebihi limit pelanggan.
- Halaman Kasir: sidebar shortcut (diatur admin), keranjang, shortkey lengkap
  (F2 cari barang, F4 ubah qty, F7 tahan transaksi, F8 panggil transaksi tertahan,
  F12 bayar, panah atas/bawah navigasi baris, Delete hapus baris, Esc reset keranjang),
  biaya antar barang.
- Scan barcode: scanner fisik (USB/Bluetooth) langsung terdeteksi seperti keyboard,
  **atau sambungkan HP jadi alat scan jarak jauh lewat kode QR** — sekali sambung,
  hasil scan dari HP langsung terpakai di halaman mana pun sedang dibuka di layar
  utama (di kasir → tambah ke keranjang, di halaman lain → tampil info barang).
- Wajib isi/konfirmasi modal awal (ditentukan admin per akun) setelah login.
- Kasbon pelanggan, Retur barang (dari pelanggan & ke supplier).
- Shift & Kas: modal awal per akun kasir, kas & pengeluaran toko, riwayat shift.
- Produk & Harga bertingkat: eceran, grosir, setengah grosir, kiloan (kg/1-2 kg/ons),
  dan harga khusus "Antar Luar Kota".
- Stok & Barang Masuk (barang masuk dari supplier, koreksi/barang rusak).
- Label & Barcode (pengaturan ukuran label, tambah/edit/hapus barcode kustom).
- Supplier, Pembelian (pesanan → terima barang → stok & hutang otomatis).
- Pelanggan (diskon %, limit kasbon).
- Log Aktivitas, Manajemen Pengguna (admin/kasir), Pengaturan Toko (tema
  terang/gelap, kustomisasi halaman login).
- Dashboard admin real-time: penjualan, laba per produk, produk terlaris,
  notifikasi stok menipis dan transaksi baru, tren penjualan 7 hari, ekspor CSV.
- Bisa **dipasang/di-download** seperti aplikasi (PWA) di HP/laptop kasir —
  tidak wajib, tapi tombol "Pasang Aplikasi di Perangkat Ini" muncul otomatis
  di halaman login pada browser yang mendukung (Chrome/Edge Android & desktop).

## 1. Setup Supabase

1. Buat project baru di https://supabase.com.
2. Buka **SQL Editor**, jalankan seluruh isi file `supabase/schema.sql` (satu kali).
3. Jalankan juga `supabase/migration-02-fitur-tambahan.sql`, lalu `supabase/migration-03-perbaikan.sql`, lalu `supabase/migration-04-harga-bertingkat.sql` (satu kali, berurutan).
3. Buka **Authentication > Users > Add user**, buat akun admin pertama:
   - Email: `namaadmin@kasir.local` (format ini dipakai karena aplikasi login
     dengan **username**, bukan email — sistem menambahkan `@kasir.local` otomatis)
   - Password: bebas, ingat baik-baik.
   - Centang "Auto Confirm User".
4. Salin **User UID** akun tadi, lalu jalankan SQL berikut di SQL Editor
   (ganti `<UID>` dan `<nama>`):

   ```sql
   insert into profiles (id, full_name, username, role, active, default_opening_cash)
   values ('<UID>', 'Nama Admin', 'namaadmin', 'admin', true, 0);
   ```

5. Buka **Project Settings > API**, salin:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (rahasia, jangan dibagikan)

## 2. Jalankan di Komputer (opsional, untuk uji coba lokal)

```bash
cp .env.example .env.local
# isi .env.local dengan 3 nilai dari langkah di atas
npm install
npm run dev
```

Buka http://localhost:3000, login dengan username & password admin yang dibuat tadi.

## 3. Push ke GitHub

```bash
git init
git add .
git commit -m "Aplikasi POS kasir"
git branch -M main
git remote add origin https://github.com/<username-anda>/<nama-repo>.git
git push -u origin main
```

## 4. Deploy ke Vercel

1. Buka https://vercel.com/new, pilih repository GitHub yang barusan dibuat.
2. Saat konfigurasi project, buka **Environment Variables**, tambahkan 4 variabel
   yang sama seperti di `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (bebas isi apa saja, string acak — dipakai untuk mengamankan jadwal Arsip Data otomatis)
3. Klik **Deploy**. Setelah selesai, aplikasi bisa diakses dari domain `*.vercel.app`
   yang diberikan Vercel (atau domain kustom Anda).

## Setelah Live

- Login sebagai admin → menu **Pengguna** untuk membuat akun kasir.
- Menu **Produk & Harga** untuk mengisi data barang.
- Menu **Shortcut Kasir** untuk mengatur tombol keyboard aksi kasir (cari, ubah qty, tahan, panggil, bayar, buka laci).
- Menu **Pengaturan Toko** untuk identitas toko & tampilan halaman login.

## Catatan Teknis & Batasan Versi Ini

- **Scanner HP via QR**: memakai fitur Realtime Supabase (broadcast channel), aktif
  secara default di semua project Supabase baru. Jika ternyata tidak tersambung,
  cek **Project Settings > Realtime** di dashboard Supabase, pastikan tidak dinonaktifkan.
  HP dan layar utama harus dalam kondisi online (butuh internet, tidak bisa offline).

- **Pembayaran digital**: saat ini pencatatan manual (tunai/transfer/QRIS manual).
  Integrasi payment gateway otomatis (Midtrans/Xendit dll.) belum terhubung —
  bisa ditambahkan di modul Pembayaran (`PaymentModal.js`) pada iterasi berikutnya.
- **Ekspor ke Google Spreadsheet**: belum ada endpoint OAuth Google Sheets;
  data laporan bisa diekspor CSV secara manual dari tabel Supabase untuk saat ini,
  otomasi penuh perlu kredensial Google Cloud terpisah.
- **Multi-bahasa**: struktur teks sudah dalam Bahasa Indonesia; untuk multi-bahasa
  penuh perlu ditambahkan sistem i18n (mis. `next-intl`).
- **Backup otomatis ke cloud**: Supabase sudah melakukan backup harian otomatis
  di paket berbayarnya (Point-in-Time Recovery); untuk backup tambahan ke
  penyimpanan lain perlu dijadwalkan terpisah (mis. Supabase scheduled function).
- **Arsip data**: transaksi lama ditandai sebagai arsip lewat halaman **Arsip Data** —
  bisa manual (klik "Jalankan Sekarang") atau otomatis sesuai jadwal (dijalankan lewat
  Vercel Cron setiap hari, hanya benar-benar memproses saat jadwalnya sudah waktunya).
  Data yang diarsipkan **tidak dihapus** dan tetap bisa dibuka di halaman yang sama.
- **Scanner global**: scanner fisik dan HP (via QR) aktif di semua halaman utama yang
  ada kolom cari/pilih barang — bukan cuma di Kasir.
- **Suara nama barang**: memakai fitur bawaan browser (Web Speech API), gratis tanpa
  API luar. Beberapa browser/OS lama mungkin tidak mendukung — kalau begitu, fitur ini
  otomatis diam saja tanpa mengganggu transaksi.
- Tidak ada akun demo yang ditampilkan di aplikasi; seluruh akun dibuat manual
  oleh admin melalui menu Pengguna atau langkah setup di atas.
