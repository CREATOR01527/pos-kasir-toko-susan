-- ============================================================
-- MIGRASI TAMBAHAN #15 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-14-ikon-aplikasi.sql)
-- Fitur: Nama produk tidak boleh kembar (sama seperti barcode yang sudah
-- tidak boleh kembar sejak migration-06).
--
-- PENTING — CEK DULU SEBELUM MENJALANKAN:
-- Kalau di data Anda SUDAH ADA produk dengan nama yang sama persis (beda
-- besar/kecil huruf atau spasi dianggap sama), migrasi ini akan GAGAL
-- dijalankan (Postgres menolak membuat aturan "wajib unik" kalau datanya
-- sendiri sudah melanggar aturan itu).
--
-- Jalankan dulu query ini untuk mengecek:
--
--   select lower(btrim(name)) as nama, count(*), array_agg(id) as id_produk
--   from products
--   group by lower(btrim(name))
--   having count(*) > 1;
--
-- Kalau hasilnya KOSONG (tidak ada baris), aman lanjut ke bawah.
-- Kalau ADA hasilnya, ganti dulu salah satu nama produk yang kembar itu
-- lewat halaman Produk & Harga (atau hapus salah satunya kalau memang
-- duplikat tidak sengaja), baru jalankan migrasi ini.
-- ============================================================

create unique index if not exists idx_products_name_unique
  on products (lower(btrim(name)));
