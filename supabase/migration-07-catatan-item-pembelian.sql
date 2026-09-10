-- ============================================================
-- MIGRASI TAMBAHAN #7 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-06-barcode-unik-dan-nota.sql)
-- ============================================================

-- Catatan per baris barang di nota pembelian, dipakai untuk menyimpan alasan
-- kalau jumlahnya dikurangi lewat tombol "Koreksi / Rusak" di halaman
-- Stok & Barang Masuk (contoh: "Dikurangi 2 (rusak: dus penyok)").
alter table purchase_order_items add column if not exists note text;
