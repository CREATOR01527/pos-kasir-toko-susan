"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatNumber } from "@/lib/format";
import { BARCODE_EVENT } from "./ScannerProvider";

// Widget ini TIDAK aktif di halaman yang sudah punya penanganan scan sendiri
// (Kasir menambah ke keranjang; Produk/Stok/Label&Barcode/Retur/Pembelian mengisi
// kolom form/pencarian masing-masing). Di halaman admin LAIN yang belum punya
// penanganan khusus, hasil scan ditampilkan sebagai info singkat: nama, harga, stok.
const PAGES_WITH_OWN_HANDLING = [
  "/kasir",
  "/admin/produk",
  "/admin/stok",
  "/admin/label-barcode",
  "/admin/retur",
  "/admin/pembelian",
];

export default function GlobalScanToast() {
  const pathname = usePathname();
  const supabaseRef = useRef(null);
  const cacheRef = useRef(null);
  const cacheTimeRef = useRef(0);

  useEffect(() => {
    function getSupabase() {
      if (!supabaseRef.current) supabaseRef.current = createClient();
      return supabaseRef.current;
    }

    async function findProduct(code) {
      const now = Date.now();
      if (!cacheRef.current || now - cacheTimeRef.current > 30000) {
        const { data } = await getSupabase()
          .from("products")
          .select("id, name, sell_price, stock_qty, sku, product_barcodes(barcode)")
          .eq("active", true);
        cacheRef.current = data || [];
        cacheTimeRef.current = now;
      }
      return cacheRef.current.find(
        (p) => p.sku === code || (p.product_barcodes || []).some((b) => b.barcode === code)
      );
    }

    async function onScan(e) {
      if (PAGES_WITH_OWN_HANDLING.some((p) => pathname?.startsWith(p))) return;
      const code = e.detail?.code;
      if (!code) return;
      const product = await findProduct(code);
      if (product) {
        toast.success(
          `${product.name} · ${formatRupiah(product.sell_price)} · Stok ${formatNumber(product.stock_qty, 2)}`,
          { icon: "🔎", id: "scan-found" }
        );
      } else {
        toast.error(`Barcode "${code}" tidak ditemukan`, { id: "scan-found" });
      }
    }

    window.addEventListener(BARCODE_EVENT, onScan);
    return () => window.removeEventListener(BARCODE_EVENT, onScan);
  }, [pathname]);

  return null;
}
