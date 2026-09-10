# Panduan Lengkap Setup Aplikasi POS Kasir

Ikuti urutan ini dari atas ke bawah. Total waktu sekitar 30-45 menit untuk yang baru pertama kali.

---

## BAGIAN 1 — Menyiapkan Database di Supabase

### 1.1 Buat akun & project

1. Buka https://supabase.com → klik **Start your project** → daftar/login (bisa pakai akun GitHub).
2. Klik **New project**.
3. Isi:
   - **Name**: bebas, mis. `pos-toko-saya`
   - **Database Password**: buat password kuat, **simpan di tempat aman** (bukan password login toko, ini password database).
   - **Region**: pilih yang terdekat, mis. `Southeast Asia (Singapore)`.
4. Klik **Create new project**, tunggu 1-2 menit sampai project siap.

### 1.2 Jalankan skema database

1. Di sidebar kiri Supabase, klik **SQL Editor**.
2. Klik **New query**.
3. Buka file `supabase/schema.sql` dari folder aplikasi (hasil unduhan sebelumnya), **copy semua isinya**.
4. Tempel ke SQL Editor, klik **Run** (atau Ctrl+Enter).
5. Pastikan muncul tulisan **Success. No rows returned** — berarti semua tabel berhasil dibuat.
6. Ulangi langkah yang sama untuk file `supabase/migration-02-fitur-tambahan.sql`, `supabase/migration-03-perbaikan.sql`, lalu `supabase/migration-04-harga-bertingkat.sql` (New query → copy isi file → Run, berurutan).

> Jika muncul error "relation already exists", berarti Anda menjalankannya dua kali — aman, abaikan saja.

### 1.3 Buat akun Admin pertama

1. Di sidebar kiri, klik **Authentication** → tab **Users** → klik **Add user** → **Create new user**.
2. Isi:
   - **Email**: `namaadmin@kasir.local` (ganti `namaadmin` sesuai username yang Anda mau, boleh huruf kecil saja)
   - **Password**: buat password untuk login admin nanti, catat baik-baik.
   - Centang **Auto Confirm User**.
3. Klik **Create user**.
4. Klik user yang baru dibuat, **copy nilai "User UID"** (bentuknya kode panjang seperti `a1b2c3d4-...`).
5. Kembali ke **SQL Editor** → **New query**, tempel ini (ganti bagian `<...>`):

   ```sql
   insert into profiles (id, full_name, username, role, active, default_opening_cash)
   values ('<TEMPEL_USER_UID_DI_SINI>', 'Nama Anda', 'namaadmin', 'admin', true, 0);
   ```

   Ganti `'namaadmin'` supaya sama persis dengan bagian sebelum `@kasir.local` di email tadi.
6. Klik **Run**. Jika sukses, akun admin Anda siap dipakai login.

### 1.4 Ambil kunci API

1. Klik ikon gerigi **Project Settings** (bawah sidebar kiri) → **API**.
2. Catat 3 nilai berikut (akan dipakai di Bagian 3):
   - **Project URL** → contoh: `https://abcdefgh.supabase.co`
   - **anon public** key → deretan huruf/angka panjang
   - **service_role** key → deretan huruf/angka panjang (klik "Reveal" untuk melihatnya). **Jaga kerahasiaan ini**, jangan pernah dibagikan atau di-upload ke GitHub.

---

## BAGIAN 2 — Push Kode ke GitHub

### 2.1 Buat repository baru

1. Buka https://github.com/new (login/daftar dulu jika belum punya akun).
2. **Repository name**: mis. `pos-kasir-toko`.
3. Pilih **Private** (disarankan, karena ini aplikasi bisnis Anda).
4. Jangan centang "Add README" (biar tidak bentrok). Klik **Create repository**.

### 2.2 Upload kode dari folder aplikasi

Buka folder hasil unduhan aplikasi di komputer Anda, lalu jalankan Terminal/Command Prompt di folder tersebut, ketik satu per satu:

```bash
git init
git add .
git commit -m "Aplikasi POS kasir"
git branch -M main
git remote add origin https://github.com/USERNAME_ANDA/pos-kasir-toko.git
git push -u origin main
```

Ganti `USERNAME_ANDA` dan `pos-kasir-toko` sesuai punya Anda. Saat diminta login, gunakan username GitHub + Personal Access Token (bukan password biasa — GitHub akan memandu membuatnya jika diminta).

> Tidak punya `git` di komputer? Alternatif: di halaman repository GitHub, klik **Add file → Upload files**, lalu drag semua isi folder aplikasi ke sana dan klik **Commit changes**.

---

## BAGIAN 3 — Deploy ke Vercel

1. Buka https://vercel.com/new, login pakai akun GitHub Anda.
2. Klik **Import** pada repository `pos-kasir-toko` yang barusan dibuat.
3. Di bagian **Environment Variables**, tambahkan 4 baris berikut satu per satu (pakai nilai dari langkah 1.4):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL Anda |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key Anda |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key Anda |
   | `CRON_SECRET` | ketik bebas string acak, mis. `rahasia-arsip-toko-susan-2026` |

4. Klik **Deploy**. Tunggu 1-3 menit.
5. Setelah selesai, klik **Visit** — aplikasi Anda sudah online di alamat seperti `pos-kasir-toko.vercel.app`.

---

## BAGIAN 4 — Login Pertama Kali & Konfigurasi Awal

1. Buka alamat Vercel Anda, login dengan **username** (bagian sebelum `@kasir.local`) dan password admin yang dibuat di langkah 1.3.
2. Setelah masuk, urutan yang disarankan:
   - **Pengaturan Toko** → isi nama toko, alamat, dan tampilan halaman login.
   - **Produk & Harga** → tambahkan barang-barang toko (bisa isi harga grosir/kiloan sekalian).
   - **Pengguna** → buat akun kasir untuk setiap karyawan, tentukan modal awal masing-masing.
   - **Shortcut Kasir** → atur tombol keyboard aksi kasir (cari, ubah qty, tahan, panggil, bayar, buka laci).
   - **Supplier** & **Pelanggan** → isi data jika diperlukan.
3. Minta kasir login pakai akun masing-masing di komputer/HP kasir — halaman kasir akan otomatis meminta konfirmasi modal awal saat pertama login setiap shift.

---

## Kalau Ada Kendala

- **Tidak bisa login** → cek lagi email di Authentication Supabase harus persis `username@kasir.local`, dan baris di tabel `profiles` harus punya `id` yang sama dengan User UID.
- **Menu Pengguna gagal menambah akun** → pastikan `SUPABASE_SERVICE_ROLE_KEY` sudah benar di Environment Variables Vercel, lalu redeploy (Vercel → Deployments → titik tiga → Redeploy).
- **Setelah ubah kode**, cukup `git push` lagi — Vercel otomatis build ulang setiap ada push ke branch `main`.
- **Ganti environment variable di Vercel** → setelah menyimpan, wajib klik Redeploy supaya perubahan berlaku.
