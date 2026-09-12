-- ============================================================
-- MIGRASI TAMBAHAN #11 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-10-notifikasi.sql)
-- Fitur: MULTI-CABANG — TAHAP 1
--
-- PENTING — BACA DULU SEBELUM MENJALANKAN:
-- Migrasi ini menambahkan pencatatan & pelaporan PER CABANG (setiap
-- transaksi tercatat milik cabang mana, kasir ditugaskan ke satu
-- cabang, dan laporan/dashboard bisa difilter per cabang).
--
-- Migrasi ini SENGAJA TIDAK memisahkan STOK BARANG per cabang — stok
-- produk tetap satu database bersama seperti sekarang. Memisah stok
-- per cabang menyentuh hampir semua alur (kasir, pembelian, retur,
-- opname, label harga) dan berisiko tinggi kalau dikerjakan sekaligus
-- tanpa pengujian di server sungguhan. Kalau nanti benar-benar butuh
-- stok terpisah per cabang, itu dikerjakan sebagai tahap 2 terpisah.
-- ============================================================

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Cabang pertama otomatis dibuat dari data toko yang sudah ada, supaya
-- data lama tidak "menggantung" tanpa cabang.
insert into branches (id, name, address, phone)
select gen_random_uuid(), coalesce(store_name, 'Cabang Utama'), store_address, store_phone
from store_settings
where id = 1
  and not exists (select 1 from branches);

-- Kasir ditugaskan ke satu cabang. NULL = akun admin (akses semua cabang).
alter table profiles add column if not exists branch_id uuid references branches(id);

-- Setiap transaksi tercatat milik satu cabang (dari cabang kasir yang login).
alter table transactions add column if not exists branch_id uuid references branches(id);

-- Isi branch_id transaksi lama dengan "Cabang Utama" yang baru dibuat,
-- supaya laporan lama tidak hilang datanya.
update transactions set branch_id = (select id from branches order by created_at asc limit 1)
where branch_id is null;

alter table branches enable row level security;

drop policy if exists "branches_select" on branches;
create policy "branches_select" on branches for select using (is_active_user());

drop policy if exists "branches_admin_all" on branches;
create policy "branches_admin_all" on branches for all using (is_admin()) with check (is_admin());
