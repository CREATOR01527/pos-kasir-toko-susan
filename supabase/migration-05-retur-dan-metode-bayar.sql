-- ============================================================
-- MIGRATION 05 — Retur ke supplier (status ambil) & pembersihan otomatis
-- Jalankan di Supabase SQL Editor, SATU KALI, setelah migration-04.
-- ============================================================

-- Status pengambilan retur ke supplier: "belum_diambil" (masih di daftar retur,
-- menunggu supplier ambil) atau "sudah_diambil" (pindah ke riwayat, dan
-- otomatis dihapus permanen 1 bulan setelah tanggal ini).
alter table returns add column if not exists pickup_status text not null default 'belum_diambil'
  check (pickup_status in ('belum_diambil','sudah_diambil'));
alter table returns add column if not exists picked_up_at timestamptz;

-- Retur dari pelanggan tidak melalui alur "diambil supplier", jadi retur
-- pelanggan yang sudah ada dianggap selesai dari awal (tidak muncul di
-- daftar "belum diambil").
update returns
set pickup_status = 'sudah_diambil', picked_up_at = coalesce(picked_up_at, created_at)
where return_type = 'customer';

-- Perlu izin update (untuk tombol "Sudah Diambil") dan delete (untuk
-- pembersihan otomatis riwayat retur setelah 1 bulan) yang sebelumnya
-- belum ada di tabel returns.
create policy "returns_update" on returns for update using (is_active_user());
create policy "returns_delete" on returns for delete using (is_active_user());
