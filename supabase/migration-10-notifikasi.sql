-- ============================================================
-- MIGRASI TAMBAHAN #10 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-09-pajak.sql)
-- Fitur: Notifikasi otomatis (stok menipis & laporan penjualan harian)
--
-- Catatan: memakai Telegram (bukan WhatsApp API) karena Telegram Bot
-- gratis, tidak perlu verifikasi bisnis, dan tinggal isi Bot Token +
-- Chat ID di halaman Pengaturan. Untuk kirim STRUK ke pelanggan,
-- aplikasi tetap pakai tombol "Kirim via WhatsApp" (link wa.me, tanpa
-- API berbayar) — itu terpisah dari notifikasi ini.
-- ============================================================

alter table store_settings add column if not exists telegram_bot_token text;
alter table store_settings add column if not exists telegram_chat_id text;
alter table store_settings add column if not exists notif_low_stock_enabled boolean not null default false;
alter table store_settings add column if not exists notif_daily_report_enabled boolean not null default false;

-- Supaya notifikasi stok menipis tidak berulang-ulang tiap jam untuk barang
-- yang sama; hanya dikirim ulang otomatis kalau sudah lewat 20 jam.
alter table products add column if not exists last_low_stock_notified_at timestamptz;
