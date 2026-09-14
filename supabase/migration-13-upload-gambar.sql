-- ============================================================
-- MIGRASI TAMBAHAN #13 — jalankan SEKALI di SQL Editor Supabase
-- (setelah migration-12-cabang-stok.sql)
-- Fitur: Upload gambar langsung (QRIS toko, latar layar login, dll) —
-- sebelumnya kolom-kolom ini cuma bisa diisi link URL manual.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('toko-images', 'toko-images', true)
on conflict (id) do nothing;

-- Semua orang boleh MELIHAT gambar (supaya tampil di struk/layar login tanpa
-- perlu login) — wajar karena bucket ini memang untuk gambar publik toko,
-- bukan data pribadi.
drop policy if exists "toko_images_public_read" on storage.objects;
create policy "toko_images_public_read" on storage.objects for select
  using (bucket_id = 'toko-images');

-- Hanya pengguna yang sudah login (admin/kasir aplikasi ini) yang boleh
-- mengunggah/mengubah/menghapus gambar.
drop policy if exists "toko_images_authenticated_write" on storage.objects;
create policy "toko_images_authenticated_write" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'toko-images');

drop policy if exists "toko_images_authenticated_update" on storage.objects;
create policy "toko_images_authenticated_update" on storage.objects for update
  to authenticated
  using (bucket_id = 'toko-images')
  with check (bucket_id = 'toko-images');

drop policy if exists "toko_images_authenticated_delete" on storage.objects;
create policy "toko_images_authenticated_delete" on storage.objects for delete
  to authenticated
  using (bucket_id = 'toko-images');
