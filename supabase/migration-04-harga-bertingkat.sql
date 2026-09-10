-- ============================================================
-- MIGRASI TAMBAHAN #4 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-03-perbaikan.sql)
-- ============================================================

-- 1) Harga BELI (modal) per tingkatan — supaya laba grosir/kiloan dihitung
--    dari modal yang sesuai, bukan disamakan dengan modal eceran.
alter table product_wholesale_pricing add column if not exists wholesale_cost_price numeric(14,2);
alter table product_wholesale_pricing add column if not exists half_wholesale_cost_price numeric(14,2);

alter table product_kg_pricing add column if not exists cost_per_kg numeric(14,2);
alter table product_kg_pricing add column if not exists cost_per_half_kg numeric(14,2);
alter table product_kg_pricing add column if not exists cost_per_ons numeric(14,2);

-- 2) Pesanan pembelian sekarang mencatat tingkatan harga yang dibeli (eceran/grosir/
--    setengah grosir/kiloan dst), supaya saat "Terima Barang" bisa memperbarui
--    kolom harga modal yang tepat, bukan cuma harga modal eceran.
alter table purchase_order_items add column if not exists price_type text not null default 'retail'
  check (price_type in ('retail','grosir','half_grosir','kg','half_kg','ons'));

-- 3) Harga jual baru per tingkatan, dicatat lewat Pesanan Pembelian saat ada
--    perubahan harga dari supplier (opsional — kosong berarti tidak berubah,
--    dipakai untuk memperbarui harga jual produk saat barang diterima).
alter table purchase_order_items add column if not exists new_sell_price numeric(14,2);
