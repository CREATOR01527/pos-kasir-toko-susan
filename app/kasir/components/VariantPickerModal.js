"use client";

import { formatRupiah } from "@/lib/format";
import { getPriceVariants } from "@/lib/pricing";

export default function VariantPickerModal({ product, onPick, onClose }) {
  const variants = getPriceVariants(product);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-1">{product.name}</h2>
        <p className="text-xs text-ink-muted mb-4">Pilih satuan / jenis harga</p>
        <div className="space-y-2">
          {variants.map((v) => (
            <button
              key={v.price_type}
              onClick={() => onPick(v)}
              className="w-full flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:border-primary hover:bg-primary-soft transition text-left"
            >
              <span>{v.label}</span>
              <span className="font-medium">{formatRupiah(v.unit_price)}</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full text-sm text-ink-muted py-2 hover:text-ink">
          Batal (Esc)
        </button>
      </div>
    </div>
  );
}
