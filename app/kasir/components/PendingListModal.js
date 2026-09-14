"use client";

import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { formatRupiah, formatDateTime } from "@/lib/format";

export default function PendingListModal({ transactions, hotkeyLabel, onRecall, onDelete, onClose }) {
  // Tombol "Tutup (Esc)" di bawah janji bisa ditutup pakai Escape -- pasang
  // beneran di sini, sebelumnya cuma tulisan tanpa fungsi.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleDelete(e, tx) {
    e.stopPropagation();
    if (confirm("Batalkan transaksi tertahan ini? Barang di dalamnya tidak akan kembali ke keranjang.")) {
      onDelete?.(tx);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-2xl w-full max-w-md p-5 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-1">Transaksi Tertahan ({hotkeyLabel || "F8"})</h2>
        <p className="text-xs text-ink-muted mb-4">Pilih transaksi untuk dipanggil kembali ke keranjang, atau batalkan dengan ikon tong sampah.</p>
        {transactions.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-8">Tidak ada transaksi yang ditahan.</p>
        )}
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="w-full flex items-stretch gap-2 rounded-lg border border-border hover:border-primary hover:bg-primary-soft transition"
            >
              <button
                onClick={() => onRecall(tx)}
                className="flex-1 text-left px-3 py-2.5 min-w-0"
              >
                <div className="flex justify-between text-sm font-medium">
                  <span>{tx.transaction_items?.length || 0} item</span>
                  <span>{formatRupiah(tx.total)}</span>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">{formatDateTime(tx.created_at)}</p>
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(e, tx)}
                title="Batalkan transaksi tertahan ini"
                className="shrink-0 px-3 flex items-center justify-center text-ink-muted hover:text-danger hover:bg-danger-soft rounded-r-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full text-sm text-ink-muted py-2 hover:text-ink">
          Tutup (Esc)
        </button>
      </div>
    </div>
  );
}
