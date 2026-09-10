-- ============================================================
-- MIGRASI TAMBAHAN #8 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-07-catatan-item-pembelian.sql)
-- ============================================================

-- Pengaturan struk pembayaran, diatur admin di halaman Pengaturan > Struk
-- Pembayaran. store_settings sudah punya store_name/store_address/store_phone/
-- receipt_footer sebelumnya, di sini ditambah kontrol tambahan.
alter table store_settings add column if not exists receipt_paper_size text not null default '58mm'
  check (receipt_paper_size in ('58mm', '80mm'));
alter table store_settings add column if not exists receipt_show_address boolean not null default true;
alter table store_settings add column if not exists receipt_show_phone boolean not null default true;
alter table store_settings add column if not exists receipt_show_cashier boolean not null default true;
alter table store_settings add column if not exists receipt_show_customer boolean not null default true;
alter table store_settings add column if not exists receipt_auto_print boolean not null default true;
