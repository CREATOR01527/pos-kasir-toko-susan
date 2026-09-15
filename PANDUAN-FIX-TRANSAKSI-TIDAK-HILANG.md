# Fix: Shift & Kas — tidak bisa dihapus, menggantung status "Berjalan"

## Penyebab
1. **Bug database (pola sama seperti kasus transaksi kemarin):** tabel
   `shifts` di Supabase RLS-nya aktif tapi tidak ada policy DELETE, jadi
   penghapusan gagal diam-diam.
2. **Fitur yang belum ada:** halaman admin "Shift & Kas" sebelumnya memang
   tidak punya tombol Hapus/Tutup untuk baris shift sama sekali. Kalau kasir
   pakai tombol "Keluar (Tanpa Tutup Shift)" di aplikasi kasir, shift itu
   akan menggantung selamanya berstatus **open** (tampil "Berjalan"),
   dan admin tidak bisa berbuat apa-apa terhadapnya.

## Yang sudah diperbaiki
- `supabase/migration-17-perbaikan-hapus-shift-kas.sql` — tambah policy
  DELETE untuk shift, **hanya berlaku kalau shift itu belum punya transaksi
  sama sekali** (supaya riwayat penjualan yang sah tidak ikut kehapus).
- `app/admin/shift-kas/page.js` — tambah 2 tombol aksi per baris shift:
  - **Hapus** — untuk shift yang salah/kepencet buka dan belum ada
    transaksinya. Kalau shift itu sudah ada transaksinya, tombol ini akan
    menampilkan pesan jelas "tidak bisa dihapus" (bukan gagal diam-diam).
  - **Tutup Paksa** — muncul khusus untuk shift berstatus "Berjalan". Dipakai
    untuk shift yang sudah ada transaksinya tapi menggantung/lupa ditutup
    kasirnya. Ini menutup shift-nya (kas akhir disamakan dulu dengan modal
    awal, silakan koreksi manual lewat catatan Kas Masuk/Keluar kalau perlu).

## Cara menerapkan
1. Buka **Supabase Dashboard → SQL Editor**, jalankan isi
   `migration-17-perbaikan-hapus-shift-kas.sql`.
2. Deploy ulang aplikasi (kode `app/admin/shift-kas/page.js` sudah
   diperbarui di paket ini).
3. Coba lagi di menu **Shift & Kas**: shift yang salah buka → klik **Hapus**;
   shift lama yang menggantung "Berjalan" tapi sudah ada transaksinya →
   klik **Tutup Paksa**.

---

# Fix sebelumnya: Transaksi tertahan (jeda) yang dihapus tapi muncul lagi

Penyebab & cara pakainya sama persis — lihat
`migration-16-perbaikan-hapus-transaksi.sql` (tabel `transactions` &
`transaction_items` juga kena bug RLS yang sama: tidak ada policy DELETE).
Kalau migration 16 belum pernah dijalankan, jalankan itu juga bersamaan
dengan migration 17 di SQL Editor.
