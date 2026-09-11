// Dipakai di mana pun ada perbandingan kode barcode/SKU (hasil scan fisik,
// scan kamera HP, atau ketik manual) dengan yang tersimpan di database.
// Disamakan formatnya (dibuang spasi di ujung, huruf kecil semua) supaya
// barang yang sudah terdaftar tetap kepanggil walau ada beda spasi/huruf
// besar-kecil kecil antara saat barcode didaftarkan vs saat dipindai.
export function normalizeBarcode(code) {
  return (code || "").toString().trim().toLowerCase();
}

export function barcodeEquals(a, b) {
  const na = normalizeBarcode(a);
  if (!na) return false;
  return na === normalizeBarcode(b);
}

// Cari produk dari daftar `products` (masing-masing punya `sku` dan
// `product_barcodes: [{barcode}]`) yang cocok dengan kode hasil scan.
export function findProductByCode(products, code) {
  return (products || []).find(
    (p) => barcodeEquals(p.sku, code) || (p.product_barcodes || []).some((b) => barcodeEquals(b.barcode, code))
  );
}
