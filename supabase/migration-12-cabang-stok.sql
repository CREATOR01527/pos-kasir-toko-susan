-- ============================================================
-- MIGRASI TAMBAHAN #12 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-11-cabang.sql)
-- Fitur: MULTI-CABANG — TAHAP 2 — Pisahkan STOK barang per cabang
--
-- PENTING soal data lama:
-- Stok yang sudah ada sekarang (kolom products.stock_qty) dipindah SELURUHNYA
-- ke CABANG PERTAMA saja (cabang yang otomatis dibuat di migration-11).
-- Cabang lain (kalau sudah sempat dibuat sebelum migrasi ini) akan mulai
-- dari stok 0 untuk semua barang — supaya angka stok tidak dobel-hitung.
-- Kalau cabang lain itu sebenarnya sudah punya barang fisik, admin WAJIB
-- menyesuaikan stoknya secara manual lewat halaman Produk & Harga setelah
-- migrasi ini (pilih cabangnya, lalu edit stok tiap barang).
-- ============================================================

create table if not exists product_branch_stock (
  product_id uuid not null references products(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  stock_qty numeric(14,3) not null default 0,
  min_stock numeric(14,3) not null default 0,
  primary key (product_id, branch_id)
);

alter table product_branch_stock enable row level security;
drop policy if exists "pbs_all" on product_branch_stock;
create policy "pbs_all" on product_branch_stock for all using (is_active_user()) with check (is_active_user());

-- Backfill: stok lama -> cabang pertama (Cabang Utama).
insert into product_branch_stock (product_id, branch_id, stock_qty, min_stock)
select p.id, (select id from branches order by created_at asc limit 1), p.stock_qty, p.min_stock
from products p
on conflict (product_id, branch_id) do nothing;

-- Backfill: cabang lain yang sudah lebih dulu ada -> mulai stok 0 (lihat catatan di atas).
insert into product_branch_stock (product_id, branch_id, stock_qty, min_stock)
select p.id, b.id, 0, p.min_stock
from products p
cross join branches b
where b.id <> (select id from branches order by created_at asc limit 1)
on conflict (product_id, branch_id) do nothing;

-- Trigger: produk baru otomatis dapat baris stok (mulai 0) di semua cabang aktif.
create or replace function create_branch_stock_for_new_product() returns trigger as $$
begin
  insert into product_branch_stock (product_id, branch_id, stock_qty, min_stock)
  select new.id, b.id, 0, coalesce(new.min_stock, 0) from branches b where b.active = true
  on conflict (product_id, branch_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_product_branch_stock on products;
create trigger trg_new_product_branch_stock after insert on products
for each row execute function create_branch_stock_for_new_product();

-- Trigger: cabang baru otomatis dapat baris stok (mulai 0) untuk semua produk yang sudah ada.
create or replace function create_product_stock_for_new_branch() returns trigger as $$
begin
  insert into product_branch_stock (product_id, branch_id, stock_qty, min_stock)
  select p.id, new.id, 0, coalesce(p.min_stock, 0) from products p
  on conflict (product_id, branch_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_new_branch_product_stock on branches;
create trigger trg_new_branch_product_stock after insert on branches
for each row execute function create_product_stock_for_new_branch();

-- Pergerakan stok & pembelian juga ditandai milik cabang mana.
alter table stock_movements add column if not exists branch_id uuid references branches(id);
alter table purchase_orders add column if not exists branch_id uuid references branches(id);
alter table returns add column if not exists branch_id uuid references branches(id);

update stock_movements set branch_id = (select id from branches order by created_at asc limit 1) where branch_id is null;
update purchase_orders set branch_id = (select id from branches order by created_at asc limit 1) where branch_id is null;
update returns set branch_id = (select id from branches order by created_at asc limit 1) where branch_id is null;

-- Catatan: kolom products.stock_qty & products.min_stock TIDAK dihapus (supaya
-- tidak ada risiko kehilangan data / laporan lama yang mungkin masih membaca
-- kolom ini), tapi setelah migrasi ini aplikasi tidak lagi memakainya sebagai
-- sumber kebenaran stok — sumber kebenarannya sekarang product_branch_stock.
