-- ============================================================
-- MIGRASI TAMBAHAN #3 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-02-fitur-tambahan.sql)
-- ============================================================

-- 1) PERBAIKAN BUG: transaction_items ternyata tidak punya kolom created_at,
--    menyebabkan laporan "Produk Terlaris" & laba di Dashboard selalu kosong.
alter table transaction_items add column if not exists created_at timestamptz not null default now();
create index if not exists idx_transaction_items_created_at on transaction_items (created_at);

-- 2) Pembayaran hutang ke supplier (transfer/cash), supaya bisa dilaporkan
--    di Dashboard dan diberi keterangan "LUNAS-Transfer" / "LUNAS-Cash".
create table if not exists supplier_payments (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  amount numeric(14,2) not null,
  method text not null check (method in ('transfer', 'cash')),
  paid_at timestamptz not null default now(),
  paid_by uuid references profiles(id)
);
alter table supplier_payments enable row level security;
create policy "supplier_payments_select" on supplier_payments for select using (is_active_user());
create policy "supplier_payments_admin_insert" on supplier_payments for insert with check (is_admin());

-- Menyimpan metode pelunasan terakhir supaya bisa ditampilkan "LUNAS-Transfer"/"LUNAS-Cash"
alter table purchase_orders add column if not exists payoff_method text check (payoff_method in ('transfer', 'cash'));
