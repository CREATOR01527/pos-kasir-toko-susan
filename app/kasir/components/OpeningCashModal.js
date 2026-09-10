"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/format";

export default function OpeningCashModal({ amount, onConfirm, loading }) {
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-1">Mulai Shift</h2>
        <p className="text-sm text-ink-muted mb-5">
          Modal awal untuk akun Anda sudah ditentukan oleh admin. Konfirmasi untuk memulai shift.
        </p>
        <div className="rounded-xl bg-primary-soft border border-primary/20 p-4 text-center mb-4">
          <p className="text-xs text-ink-muted mb-1">Modal Awal</p>
          <p className="text-2xl font-semibold text-primary">{formatRupiah(amount)}</p>
        </div>
        <label className="block text-sm font-medium mb-1.5">Catatan (opsional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 mb-4"
          placeholder="mis. serah terima dari shift pagi"
        />
        <button
          onClick={() => onConfirm(notes)}
          disabled={loading}
          className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-60"
        >
          {loading ? "Memulai..." : "Mulai Shift"}
        </button>
      </div>
    </div>
  );
}
