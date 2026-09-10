-- ============================================================
-- SKEMA DATABASE APLIKASI POS KASIR
-- Jalankan file ini di Supabase SQL Editor (satu kali, urut dari atas)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. PROFIL PENGGUNA (admin & kasir) - terhubung ke auth.users
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text unique not null,
  role text not null check (role in ('admin','kasir')) default 'kasir',
  active boolean not null default true,
  default_opening_cash numeric(14,2) not null default 0, -- modal awal yang ditentukan admin utk akun ini
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. PENGATURAN TOKO
-- ------------------------------------------------------------
create table if not exists store_settings (
  id int primary key default 1,
  store_name text not null default 'Toko Saya',
  store_address text,
  store_phone text,
  receipt_footer text default 'Terima kasih',
  theme text not null default 'light' check (theme in ('light','dark')),
  login_bg_url text,
  login_title text default 'Masuk ke Aplikasi Kasir',
  login_font_family text default 'Inter',
  login_font_weight text default '600',
  login_font_color text default '#111827',
  login_accent_color text default '#2563eb',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into store_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. PRODUK & HARGA BERTINGKAT
-- ------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  unit_type text not null check (unit_type in ('unit','kg')) default 'unit', -- unit = biasa/grosir, kg = kiloan
  cost_price numeric(14,2) not null default 0,       -- harga modal per satuan dasar (per pcs / per kg)
  sell_price numeric(14,2) not null default 0,       -- harga jual eceran/retail normal
  stock_qty numeric(14,3) not null default 0,        -- untuk kg bisa desimal
  min_stock numeric(14,3) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Harga grosir & setengah grosir (untuk produk unit_type = 'unit')
create table if not exists product_wholesale_pricing (
  product_id uuid primary key references products(id) on delete cascade,
  wholesale_qty int,            -- isi per grosir, contoh: 12 pcs
  wholesale_price numeric(14,2),-- harga jual per grosir (paket)
  half_wholesale_qty int,       -- isi setengah grosir, contoh: 6 pcs
  half_wholesale_price numeric(14,2)
);

-- Harga kiloan (untuk produk unit_type = 'kg')
create table if not exists product_kg_pricing (
  product_id uuid primary key references products(id) on delete cascade,
  price_per_kg numeric(14,2),
  price_per_half_kg numeric(14,2),
  price_per_ons numeric(14,2)    -- per 100gram / peronan
);

-- Harga khusus "antar luar kota" (harga barang tertentu, bukan biaya kirim)
create table if not exists product_out_of_town_pricing (
  product_id uuid primary key references products(id) on delete cascade,
  price numeric(14,2) not null
);

-- Barcode tambahan / custom per produk (barang curah tanpa barcode pabrik)
create table if not exists product_barcodes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  barcode text not null unique,
  note text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. SUPPLIER
-- ------------------------------------------------------------
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  phone text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. PELANGGAN
-- ------------------------------------------------------------
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  customer_type text default 'Umum',
  discount_percent numeric(5,2) not null default 0,
  kasbon_limit numeric(14,2) not null default 0, -- 0 = tanpa batas
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. SHIFT & KAS KASIR
-- ------------------------------------------------------------
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references profiles(id),
  opening_cash numeric(14,2) not null,
  opening_time timestamptz not null default now(),
  closing_cash numeric(14,2),
  closing_time timestamptz,
  expected_cash numeric(14,2),
  cash_difference numeric(14,2),
  status text not null default 'open' check (status in ('open','closed')),
  notes text
);

-- Kas & pengeluaran toko (bisa tambah/hapus) — mis. "Plastik & Kemasan"
create table if not exists cash_movements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('masuk','keluar')),
  category text,                 -- contoh: "Plastik & Kemasan"
  description text not null,     -- contoh: "Kantong plastik 2 pak"
  amount numeric(14,2) not null,
  movement_date timestamptz not null default now(),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. TRANSAKSI KASIR
-- ------------------------------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id),
  cashier_id uuid references profiles(id),
  customer_id uuid references customers(id),
  transaction_date timestamptz not null default now(),
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  delivery_fee numeric(14,2) not null default 0, -- biaya antar barang
  total numeric(14,2) not null default 0,
  payment_method text default 'tunai' check (payment_method in ('tunai','transfer','qris','kasbon')),
  paid_amount numeric(14,2) not null default 0,
  change_amount numeric(14,2) not null default 0,
  status text not null default 'completed' check (status in ('completed','pending','void')),
  is_kasbon boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  product_id uuid not null references products(id),
  price_type text not null default 'retail'
    check (price_type in ('retail','grosir','half_grosir','kg','half_kg','ons','out_of_town')),
  qty numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  cost_price_snapshot numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null
);

-- ------------------------------------------------------------
-- 8. KASBON PELANGGAN
-- ------------------------------------------------------------
create table if not exists kasbon (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  transaction_id uuid references transactions(id),
  amount numeric(14,2) not null,
  paid_amount numeric(14,2) not null default 0,
  due_date date,
  status text not null default 'belum_lunas' check (status in ('belum_lunas','lunas')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists kasbon_payments (
  id uuid primary key default gen_random_uuid(),
  kasbon_id uuid not null references kasbon(id) on delete cascade,
  amount numeric(14,2) not null,
  paid_at timestamptz not null default now(),
  received_by uuid references profiles(id),
  notes text
);

-- ------------------------------------------------------------
-- 9. RETUR BARANG (dari pelanggan & ke supplier)
-- ------------------------------------------------------------
create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  return_type text not null check (return_type in ('customer','supplier')),
  product_id uuid not null references products(id),
  qty numeric(14,3) not null,
  reason text,
  refund_amount numeric(14,2) default 0,
  reference_transaction_id uuid references transactions(id),
  reference_supplier_id uuid references suppliers(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 10. STOK & BARANG MASUK
-- ------------------------------------------------------------
create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  movement_type text not null check (movement_type in ('masuk','koreksi','pembelian','penjualan','retur')),
  qty numeric(14,3) not null, -- positif = tambah, negatif = kurang
  unit_cost numeric(14,2),
  supplier_id uuid references suppliers(id),
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 11. PEMBELIAN (Purchase Order ke supplier)
-- ------------------------------------------------------------
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id),
  due_date date,
  notes text,
  status text not null default 'pending' check (status in ('pending','diterima')),
  subtotal numeric(14,2) not null default 0,
  discount numeric(14,2) not null default 0,
  down_payment numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  remaining_debt numeric(14,2) not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  received_at timestamptz
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric(14,3) not null,
  unit_cost numeric(14,2) not null,
  subtotal numeric(14,2) not null
);

-- ------------------------------------------------------------
-- 12. LABEL & BARCODE - pengaturan cetak
-- ------------------------------------------------------------
create table if not exists label_settings (
  id int primary key default 1,
  label_size text not null default 'sedang' check (label_size in ('kecil','sedang','besar')),
  show_store_name boolean not null default true,
  show_cheapest_wholesale_unit boolean not null default true,
  show_barcode boolean not null default true,
  constraint single_row_label check (id = 1)
);
insert into label_settings (id) values (1) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 13. SHORTCUT KASIR (bisa tambah/hapus oleh admin)
-- ------------------------------------------------------------
create table if not exists cashier_shortcuts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  product_id uuid references products(id),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 14. LOG AKTIVITAS
-- ------------------------------------------------------------
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  action text not null,       -- contoh: 'create_product', 'void_transaction'
  entity text,                -- contoh: 'products', 'transactions'
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table store_settings enable row level security;
alter table products enable row level security;
alter table product_wholesale_pricing enable row level security;
alter table product_kg_pricing enable row level security;
alter table product_out_of_town_pricing enable row level security;
alter table product_barcodes enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table shifts enable row level security;
alter table cash_movements enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;
alter table kasbon enable row level security;
alter table kasbon_payments enable row level security;
alter table returns enable row level security;
alter table stock_movements enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table label_settings enable row level security;
alter table cashier_shortcuts enable row level security;
alter table activity_log enable row level security;

-- Helper: fungsi cek role admin dari JWT
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and active = true
  );
$$ language sql security definer;

create or replace function is_active_user() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and active = true
  );
$$ language sql security definer;

-- profiles: user bisa lihat profil sendiri, admin lihat semua
create policy "profiles_select" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_admin_write" on profiles for insert with check (is_admin());
create policy "profiles_admin_update" on profiles for update using (is_admin());
create policy "profiles_admin_delete" on profiles for delete using (is_admin());

-- store_settings: boleh dibaca publik (dipakai utk tampilan halaman login sebelum login), hanya admin boleh ubah
create policy "store_settings_select" on store_settings for select using (true);
create policy "store_settings_admin_write" on store_settings for update using (is_admin());

-- label_settings juga perlu dibaca kasir & admin (sudah is_active_user, cukup)


-- Tabel referensi produk/harga: semua user aktif boleh baca, hanya admin ubah
create policy "products_select" on products for select using (is_active_user());
create policy "products_admin_write" on products for insert with check (is_admin());
-- Catatan: kasir perlu mengurangi stok saat checkout, jadi update produk diizinkan
-- untuk semua user aktif (bukan hanya admin). Halaman "Produk & Harga" itu sendiri
-- tetap hanya bisa diakses lewat menu admin di aplikasi.
create policy "products_admin_update" on products for update using (is_active_user());
create policy "products_admin_delete" on products for delete using (is_admin());

create policy "wholesale_select" on product_wholesale_pricing for select using (is_active_user());
create policy "wholesale_admin_all" on product_wholesale_pricing for all using (is_admin()) with check (is_admin());

create policy "kg_select" on product_kg_pricing for select using (is_active_user());
create policy "kg_admin_all" on product_kg_pricing for all using (is_admin()) with check (is_admin());

create policy "oot_select" on product_out_of_town_pricing for select using (is_active_user());
create policy "oot_admin_all" on product_out_of_town_pricing for all using (is_admin()) with check (is_admin());

create policy "barcodes_select" on product_barcodes for select using (is_active_user());
create policy "barcodes_admin_all" on product_barcodes for all using (is_admin()) with check (is_admin());

create policy "suppliers_select" on suppliers for select using (is_active_user());
create policy "suppliers_admin_all" on suppliers for all using (is_admin()) with check (is_admin());

create policy "customers_select" on customers for select using (is_active_user());
create policy "customers_admin_all" on customers for insert with check (is_admin());
create policy "customers_admin_update" on customers for update using (is_admin());
create policy "customers_admin_delete" on customers for delete using (is_admin());

create policy "label_settings_select" on label_settings for select using (is_active_user());
create policy "label_settings_admin_write" on label_settings for update using (is_admin());

create policy "shortcuts_select" on cashier_shortcuts for select using (is_active_user());
create policy "shortcuts_admin_all" on cashier_shortcuts for all using (is_admin()) with check (is_admin());

-- Shift: kasir hanya lihat/insert/update shift miliknya, admin lihat semua
create policy "shifts_select" on shifts for select using (cashier_id = auth.uid() or is_admin());
create policy "shifts_insert" on shifts for insert with check (cashier_id = auth.uid() or is_admin());
create policy "shifts_update" on shifts for update using (cashier_id = auth.uid() or is_admin());

-- Kas & pengeluaran toko: semua user aktif lihat, admin kelola
create policy "cash_select" on cash_movements for select using (is_active_user());
create policy "cash_admin_all" on cash_movements for insert with check (is_admin());
create policy "cash_admin_update" on cash_movements for update using (is_admin());
create policy "cash_admin_delete" on cash_movements for delete using (is_admin());

-- Transaksi: kasir bisa insert transaksi sendiri & lihat transaksi sendiri, admin semua
create policy "trx_select" on transactions for select using (cashier_id = auth.uid() or is_admin());
create policy "trx_insert" on transactions for insert with check (cashier_id = auth.uid() or is_admin());
create policy "trx_update" on transactions for update using (cashier_id = auth.uid() or is_admin());

create policy "trx_items_select" on transaction_items for select using (
  exists (select 1 from transactions t where t.id = transaction_id and (t.cashier_id = auth.uid() or is_admin()))
);
create policy "trx_items_insert" on transaction_items for insert with check (
  exists (select 1 from transactions t where t.id = transaction_id and (t.cashier_id = auth.uid() or is_admin()))
);

-- Kasbon: semua user aktif lihat & catat, admin kelola penuh
create policy "kasbon_select" on kasbon for select using (is_active_user());
create policy "kasbon_insert" on kasbon for insert with check (is_active_user());
create policy "kasbon_update" on kasbon for update using (is_active_user());

create policy "kasbon_pay_select" on kasbon_payments for select using (is_active_user());
create policy "kasbon_pay_insert" on kasbon_payments for insert with check (is_active_user());

-- Retur: semua user aktif lihat & catat
create policy "returns_select" on returns for select using (is_active_user());
create policy "returns_insert" on returns for insert with check (is_active_user());

-- Stok: semua user aktif lihat; pencatatan pergerakan stok juga perlu diizinkan
-- untuk kasir (dipicu otomatis saat checkout mengurangi stok penjualan).
create policy "stock_select" on stock_movements for select using (is_active_user());
create policy "stock_insert" on stock_movements for insert with check (is_active_user());

-- Pembelian: hanya admin
create policy "po_select" on purchase_orders for select using (is_active_user());
create policy "po_admin_all" on purchase_orders for insert with check (is_admin());
create policy "po_admin_update" on purchase_orders for update using (is_admin());

create policy "po_items_select" on purchase_order_items for select using (is_active_user());
create policy "po_items_admin_insert" on purchase_order_items for insert with check (is_admin());

-- Log aktivitas: semua user aktif bisa insert (dicatat sistem), hanya admin bisa lihat
create policy "log_select" on activity_log for select using (is_admin());
create policy "log_insert" on activity_log for insert with check (is_active_user());

-- ============================================================
-- REALTIME (untuk notifikasi stok menipis & transaksi terbaru)
-- ============================================================
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table products;
