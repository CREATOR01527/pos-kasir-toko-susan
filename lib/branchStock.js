// Sejak Multi-Cabang Tahap 2, stok barang disimpan PER CABANG di tabel
// product_branch_stock (bukan lagi products.stock_qty/min_stock global).
// Helper ini membaca baris stok cabang tertentu dari produk yang sudah
// di-select dengan join `product_branch_stock(*)`.

// Kalau baris untuk cabang itu belum ada (mis. produk dibuat sebelum
// migrasi #12 dijalankan, sebelum trigger sempat membuatkan barisnya),
// fallback ke 0 supaya tidak error — bukan ke products.stock_qty lama,
// supaya tidak salah tampil seolah-olah cabang itu punya stok yang
// sebenarnya milik cabang lain.
export function getBranchStock(product, branchId) {
  const row = (product?.product_branch_stock || []).find((s) => s.branch_id === branchId);
  return { stock_qty: Number(row?.stock_qty || 0), min_stock: Number(row?.min_stock || 0) };
}
