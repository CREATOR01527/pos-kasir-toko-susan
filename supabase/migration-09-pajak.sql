-- ============================================================
-- MIGRASI TAMBAHAN #9 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-08-pengaturan-struk.sql)
-- Fitur: Pajak/PPN opsional PER PRODUK
-- ============================================================

-- Persentase pajak per produk (0 = produk ini tidak kena pajak sama sekali,
-- jadi tidak wajib dipakai untuk semua barang — misal sembako biasa 0%,
-- barang tertentu diisi 11% dst). Diisi dari halaman Produk & Harga.
alter table products add column if not exists tax_rate numeric(5,2) not null default 0
  check (tax_rate >= 0 and tax_rate <= 100);

-- Label pajak yang tampil di struk (default "PPN", bisa diganti mis. "Pajak Restoran").
alter table store_settings add column if not exists tax_label text not null default 'PPN';

-- Jika true: harga jual produk dianggap SUDAH termasuk pajak (pajak cuma
-- dipisah tampilannya di struk, tidak menambah total bayar).
-- Jika false (default): pajak DITAMBAHKAN di atas subtotal produk yang kena pajak.
alter table store_settings add column if not exists tax_price_inclusive boolean not null default false;

-- Simpan nominal pajak yang benar-benar terjadi di tiap transaksi & item,
-- supaya laporan tetap akurat walau tarif pajak produk diubah admin di kemudian hari.
alter table transactions add column if not exists tax_amount numeric(14,2) not null default 0;
alter table transaction_items add column if not exists tax_rate numeric(5,2) not null default 0;
alter table transaction_items add column if not exists tax_amount numeric(14,2) not null default 0;
