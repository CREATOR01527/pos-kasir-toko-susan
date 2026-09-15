-- Migration 17: Perbaikan bug "kas/shift tidak bisa dihapus & menggantung
-- terus dengan status Berjalan"
--
-- Penyebab #1: sama seperti bug transaksi sebelumnya — RLS aktif di tabel
-- `shifts`, tapi tidak ada policy untuk DELETE. Jadi shift yang mau dihapus
-- tidak akan pernah benar-benar terhapus dari server.
--
-- Penyebab #2: di aplikasi kasir ada tombol "Keluar (Tanpa Tutup Shift)"
-- yang membuat kasir bisa keluar tanpa menutup shift-nya. Shift itu jadi
-- menggantung selamanya berstatus "open" (tampil "Berjalan" di admin),
-- dan sebelum perbaikan ini, admin tidak punya cara menutup atau
-- menghapusnya dari halaman Shift & Kas.
--
-- Perbaikan ini menambahkan policy delete: shift hanya boleh dihapus kalau
-- BELUM punya transaksi apa pun (supaya riwayat penjualan yang sah tidak
-- ikut hilang). Untuk shift yang sudah ada transaksinya tapi menggantung,
-- gunakan tombol "Tutup Paksa" yang baru ditambahkan di halaman admin
-- (ini memakai policy UPDATE yang sudah ada, jadi tidak perlu migration
-- tambahan).

create policy "shifts_delete" on shifts for delete using (
  is_admin() and not exists (select 1 from transactions t where t.shift_id = shifts.id)
);
