"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/format";

export default function PaymentModal({ total, customer, settings, hotkeyLabel, onClose, onSubmit, loading }) {
  const [method, setMethod] = useState("tunai");
  const [paid, setPaid] = useState("");
  const paidNum = parseFloat(paid) || 0;
  const change = method === "kasbon" ? 0 : Math.max(0, paidNum - total);
  const canKasbon = !!customer;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-auto">
        <h2 className="text-lg font-semibold mb-4">Pembayaran ({hotkeyLabel || "F12"})</h2>

        <div className="rounded-xl bg-primary-soft border border-primary/20 p-4 text-center mb-4">
          <p className="text-xs text-ink-muted mb-1">Total Tagihan</p>
          <p className="text-2xl font-semibold text-primary">{formatRupiah(total)}</p>
        </div>

        <label className="block text-sm font-medium mb-1.5">Metode Pembayaran</label>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {["tunai", "transfer", "qris", "kasbon"].map((m) => (
            <button
              key={m}
              disabled={m === "kasbon" && !canKasbon}
              onClick={() => setMethod(m)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium capitalize transition ${
                method === m ? "border-primary bg-primary-soft text-primary" : "border-border text-ink-muted"
              } ${m === "kasbon" && !canKasbon ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              {m}
            </button>
          ))}
        </div>
        {method === "kasbon" && !canKasbon && (
          <p className="text-xs text-danger mb-3">Pilih pelanggan dahulu untuk pembayaran kasbon.</p>
        )}

        {method === "transfer" && settings?.bank_transfer_info && (
          <div className="rounded-lg bg-background border border-border p-3 mb-4 text-sm whitespace-pre-line">
            {settings.bank_transfer_info}
          </div>
        )}

        {method === "qris" && settings?.qris_image_url && (
          <div className="flex justify-center mb-4">
            <img src={settings.qris_image_url} alt="QRIS Toko" className="w-40 h-40 object-contain rounded-lg border border-border" />
          </div>
        )}

        {method !== "kasbon" && (
          <>
            <label className="block text-sm font-medium mb-1.5">Jumlah Diterima</label>
            <input
              autoFocus
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              inputMode="numeric"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-lg text-right outline-none focus:ring-2 focus:ring-primary/40 mb-3"
            />
            <div className="flex justify-between text-sm mb-4 px-1">
              <span className="text-ink-muted">Kembalian</span>
              <span className="font-medium">{formatRupiah(change)}</span>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium hover:bg-background">
            Batal
          </button>
          <button
            onClick={() => onSubmit({ method, paid: method === "kasbon" ? 0 : paidNum, change })}
            disabled={loading || (method !== "kasbon" && paidNum < total)}
            className="flex-1 bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Selesaikan"}
          </button>
        </div>
      </div>
    </div>
  );
}
