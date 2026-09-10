-- ============================================================
-- MIGRASI TAMBAHAN #2 — jalankan SEKALI di SQL Editor Supabase
-- (setelah schema.sql utama sudah pernah dijalankan sebelumnya)
-- ============================================================

-- 1) (dihapus) shortcut produk di sidebar kasir tidak lagi dipakai — digantikan
--    sepenuhnya oleh Shortcut Aksi Sistem (lihat poin 5 di bawah) dan barcode scanner.

-- 2) Info pembayaran manual (transfer & QRIS) untuk ditampilkan saat checkout
alter table store_settings add column if not exists bank_transfer_info text;
alter table store_settings add column if not exists qris_image_url text;

-- 3) Pengaturan tampilan login yang lebih lengkap (dropdown font, tipe background)
alter table store_settings add column if not exists login_bg_type text not null default 'color'
  check (login_bg_type in ('color', 'image', 'video'));
alter table store_settings add column if not exists login_bg_video_url text;
alter table store_settings add column if not exists login_gradient_from text default '#0f6d4f';
alter table store_settings add column if not exists login_gradient_to text default '#0b1f19';

-- 4) Arsip data — tandai transaksi lama sebagai diarsipkan (bukan dipindah/dihapus,
--    tetap bisa dibuka lewat halaman Arsip di aplikasi)
alter table transactions add column if not exists archived boolean not null default false;
alter table transactions add column if not exists archived_at timestamptz;
create index if not exists idx_transactions_archived on transactions (archived, created_at);

create table if not exists archive_settings (
  id int primary key default 1,
  auto_enabled boolean not null default false,
  archive_after_months int not null default 12,
  frequency_days int not null default 30,
  last_run_at timestamptz,
  constraint single_row_archive check (id = 1)
);
insert into archive_settings (id) values (1) on conflict (id) do nothing;

alter table archive_settings enable row level security;
create policy "archive_settings_select" on archive_settings for select using (is_active_user());
create policy "archive_settings_admin_write" on archive_settings for update using (is_admin());

-- Log setiap kali proses arsip berjalan (manual maupun otomatis)
create table if not exists archive_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  trigger_type text not null check (trigger_type in ('manual', 'otomatis')),
  rows_archived int not null default 0,
  triggered_by uuid references profiles(id)
);
alter table archive_runs enable row level security;
create policy "archive_runs_select" on archive_runs for select using (is_admin());
create policy "archive_runs_insert" on archive_runs for insert with check (is_active_user());

-- 5) Hotkey untuk AKSI SISTEM kasir (beda dari shortcut produk) — bisa diubah admin,
--    contoh: F2 untuk fokus ke kolom pencarian produk.
alter table store_settings add column if not exists action_hotkeys jsonb not null default
  '{"search": "F2", "qty": "F4", "hold": "F7", "recall": "F8", "pay": "F12"}'::jsonb;
