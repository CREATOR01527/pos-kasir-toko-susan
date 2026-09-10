"use client";

import { formatRupiah, formatDateTime } from "@/lib/format";

export default function PendingListModal({ transactions, hotkeyLabel, onRecall, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-1">Transaksi Tertahan ({hotkeyLabel || "F8"})</h2>
        <p className="text-xs text-ink-muted mb-4">Pilih transaksi untuk dipanggil kembali ke keranjang.</p>
        {transactions.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-8">Tidak ada transaksi yang ditahan.</p>
        )}
        <div className="space-y-2">
          {transactions.map((tx) => (
            <button
              key={tx.id}
              onClick={() => onRecall(tx)}
              className="w-full text-left rounded-lg border border-border px-3 py-2.5 hover:border-primary hover:bg-primary-soft transition"
            >
              <div className="flex justify-between text-sm font-medium">
                <span>{tx.transaction_items?.length || 0} item</span>
                <span>{formatRupiah(tx.total)}</span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">{formatDateTime(tx.created_at)}</p>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full text-sm text-ink-muted py-2 hover:text-ink">
          Tutup (Esc)
        </button>
      </div>
    </div>
  );
}
