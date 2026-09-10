"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/format";

export default function CloseShiftModal({ shift, onClose, onClosed }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [cashSales, setCashSales] = useState(0);
  const [actualCash, setActualCash] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("transactions")
        .select("total, payment_method")
        .eq("shift_id", shift.id)
        .eq("status", "completed")
        .eq("payment_method", "tunai");
      const sum = (data || []).reduce((s, t) => s + Number(t.total), 0);
      setCashSales(sum);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expected = Number(shift.opening_cash) + cashSales;
  const actualNum = parseFloat(actualCash) || 0;
  const difference = actualNum - expected;

  async function submit() {
    setSaving(true);
    try {
      await supabase
        .from("shifts")
        .update({
          closing_cash: actualNum,
          closing_time: new Date().toISOString(),
          expected_cash: expected,
          cash_difference: difference,
          status: "closed",
        })
        .eq("id", shift.id);
      onClosed();
    } catch (err) {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold mb-1">Tutup Shift</h2>
        <p className="text-sm text-ink-muted mb-4">Hitung uang tunai di laci, lalu cocokkan dengan sistem.</p>

        {loading ? (
          <p className="text-sm text-ink-muted">Menghitung penjualan tunai...</p>
        ) : (
          <>
            <div className="rounded-xl bg-background p-4 space-y-1.5 text-sm mb-4">
              <div className="flex justify-between"><span className="text-ink-muted">Modal Awal</span><span>{formatRupiah(shift.opening_cash)}</span></div>
              <div className="flex justify-between"><span className="text-ink-muted">Penjualan Tunai</span><span>{formatRupiah(cashSales)}</span></div>
              <div className="flex justify-between font-medium border-t border-border pt-1.5"><span>Seharusnya di Laci</span><span>{formatRupiah(expected)}</span></div>
            </div>

            <label className="block text-sm font-medium mb-1.5">Uang Tunai Aktual di Laci</label>
            <input
              autoFocus
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              inputMode="numeric"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-lg text-right outline-none focus:ring-2 focus:ring-primary/40 mb-3"
              placeholder="0"
            />
            {actualCash !== "" && (
              <p className={`text-sm mb-4 text-right ${difference === 0 ? "text-primary" : "text-danger"}`}>
                Selisih: {difference > 0 ? "+" : ""}{formatRupiah(difference)}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium hover:bg-background">
                Batal
              </button>
              <button
                onClick={submit}
                disabled={saving || actualCash === ""}
                className="flex-1 bg-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-60"
              >
                {saving ? "Menutup..." : "Tutup Shift & Keluar"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
