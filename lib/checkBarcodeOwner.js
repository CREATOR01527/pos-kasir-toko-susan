// Cek apakah sebuah kode barcode sudah dipakai produk lain, dicek silang di
// dua tempat: kolom "Barcode Utama/SKU" di tabel products, dan barcode
// tambahan di tabel product_barcodes. Dipanggil sebelum simpan supaya
// pesan error langsung jelas ("dipakai oleh produk apa"), sebagai pelengkap
// jaring pengaman trigger database (lihat migration-06-barcode-unik-dan-nota.sql).
//
// opts.excludeProductId: id produk yang sedang diedit (supaya kode punya
//   dirinya sendiri tidak dianggap bentrok).
// opts.excludeBarcodeId: id baris product_barcodes yang sedang diedit.
export async function findBarcodeConflict(supabase, code, opts = {}) {
  const { excludeProductId = null, excludeBarcodeId = null } = opts;
  const trimmed = (code || "").trim();
  if (!trimmed) return null;

  const { data: skuMatches } = await supabase
    .from("products")
    .select("id, name")
    .ilike("sku", trimmed);
  const skuHit = (skuMatches || []).find((p) => p.id !== excludeProductId);
  if (skuHit) return skuHit;

  const { data: barcodeMatches } = await supabase
    .from("product_barcodes")
    .select("id, product_id, products(name)")
    .ilike("barcode", trimmed);
  const barcodeHit = (barcodeMatches || []).find(
    (b) => b.id !== excludeBarcodeId && b.product_id !== excludeProductId
  );
  if (barcodeHit) return { id: barcodeHit.product_id, name: barcodeHit.products?.name };

  return null;
}
