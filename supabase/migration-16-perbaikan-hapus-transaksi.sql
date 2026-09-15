-- Migration 16: Perbaikan bug "transaksi yang dihapus tidak hilang"
--
-- Penyebab: RLS aktif di tabel transactions & transaction_items, tapi tidak
-- ada policy untuk perintah DELETE. Akibatnya saat kasir menghapus transaksi
-- yang ditahan (jeda), query delete tidak menghasilkan error (RLS diam-diam
-- memblokir, 0 baris terhapus), jadi tampilan di kasir seolah berhasil tapi
-- baris di database tetap ada dan muncul lagi setelah refresh.
--
-- Perbaikan: tambahkan policy delete. Kasir hanya boleh menghapus
-- transaksinya sendiri yang masih berstatus "pending" (transaksi yang
-- ditahan/belum selesai dibayar). Admin boleh menghapus semua.

create policy "trx_delete" on transactions for delete using (
  (cashier_id = auth.uid() and status = 'pending') or is_admin()
);

create policy "trx_items_delete" on transaction_items for delete using (
  exists (
    select 1 from transactions t
    where t.id = transaction_id
      and ((t.cashier_id = auth.uid() and t.status = 'pending') or is_admin())
  )
);
