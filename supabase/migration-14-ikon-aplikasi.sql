-- ============================================================
-- MIGRASI TAMBAHAN #14 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-13-upload-gambar.sql)
-- Fitur: Ikon aplikasi (PWA) bisa diganti admin sendiri, tanpa perlu
-- minta bantuan developer / edit kode setiap kali mau ganti logo.
-- ============================================================

alter table store_settings add column if not exists app_icon_url text;
