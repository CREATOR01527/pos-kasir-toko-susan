-- ============================================================
-- MIGRASI TAMBAHAN #6 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-05-retur-dan-metode-bayar.sql)
-- ============================================================

-- 1) Nomor nota untuk pesanan/penerimaan barang (halaman "Stok & Barang Masuk",
--    dulu bernama "Pembelian").
alter table purchase_orders add column if not exists nota_number text;

-- 2) Satu barcode hanya boleh dipakai oleh satu produk, berlaku untuk SEMUA
--    tipe produk (PCS maupun Timbangan) dan untuk kedua tempat barcode
--    disimpan: kolom "Barcode Utama/SKU" di tabel products, maupun barcode
--    tambahan di tabel product_barcodes (dipakai halaman Label & Barcode
--    untuk barang curah tanpa barcode pabrik).
--
-- Constraint unique biasa tidak cukup karena harus mengecek SILANG dua
-- tabel sekaligus, jadi dipakai trigger. Perbandingan tidak case-sensitive
-- (huruf besar/kecil dianggap sama) supaya "ABC123" dan "abc123" tetap
-- ditolak sebagai duplikat.
create or replace function enforce_unique_barcode() returns trigger as $$
declare
  owner_name text;
begin
  if TG_TABLE_NAME = 'products' then
    if new.sku is not null and btrim(new.sku) <> '' then
      select p.name into owner_name
      from products p
      where lower(btrim(p.sku)) = lower(btrim(new.sku)) and p.id <> new.id
      limit 1;
      if owner_name is not null then
        raise exception 'Barcode "%" sudah dipakai oleh produk "%"', new.sku, owner_name
          using errcode = 'unique_violation';
      end if;

      select pr.name into owner_name
      from product_barcodes pb
      join products pr on pr.id = pb.product_id
      where lower(btrim(pb.barcode)) = lower(btrim(new.sku)) and pb.product_id <> new.id
      limit 1;
      if owner_name is not null then
        raise exception 'Barcode "%" sudah dipakai oleh produk "%"', new.sku, owner_name
          using errcode = 'unique_violation';
      end if;
    end if;

  elsif TG_TABLE_NAME = 'product_barcodes' then
    select p.name into owner_name
    from products p
    where lower(btrim(p.sku)) = lower(btrim(new.barcode)) and p.id <> new.product_id
    limit 1;
    if owner_name is not null then
      raise exception 'Barcode "%" sudah dipakai oleh produk "%"', new.barcode, owner_name
        using errcode = 'unique_violation';
    end if;

    select pr.name into owner_name
    from product_barcodes pb
    join products pr on pr.id = pb.product_id
    where lower(btrim(pb.barcode)) = lower(btrim(new.barcode)) and pb.id <> new.id
    limit 1;
    if owner_name is not null then
      raise exception 'Barcode "%" sudah dipakai oleh produk "%"', new.barcode, owner_name
        using errcode = 'unique_violation';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_products_barcode_unique on products;
create trigger trg_products_barcode_unique
  before insert or update of sku on products
  for each row execute function enforce_unique_barcode();

drop trigger if exists trg_product_barcodes_unique on product_barcodes;
create trigger trg_product_barcodes_unique
  before insert or update of barcode on product_barcodes
  for each row execute function enforce_unique_barcode();

-- Catatan: aplikasi (halaman Produk & Harga, Label & Barcode) sudah dikasih
-- pengecekan duplikat sebelum simpan supaya pesan errornya rapi. Trigger di
-- atas adalah jaring pengaman terakhir di level database, aktif untuk semua
-- jalur simpan termasuk kalau nanti ada halaman lain yang lupa dicek dulu.
