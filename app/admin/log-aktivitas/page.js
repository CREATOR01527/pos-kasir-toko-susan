"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import { Card, EmptyState, Input } from "@/components/ui/kit";

const ACTION_LABEL = {
  open_shift: "Membuka shift",
  checkout: "Transaksi penjualan",
  stock_in: "Barang masuk",
  stock_correction: "Koreksi stok",
  return_item: "Retur barang",
  create_purchase_order: "Membuat pesanan pembelian",
  receive_purchase_order: "Menerima barang pembelian",
};

export default function LogAktivitasPage() {
  const supabase = createClient();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("activity_log")
      .select("*, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows(data || []);
    setLoading(false);
  }

  const filtered = rows.filter((r) =>
    `${r.profiles?.full_name || ""} ${r.action} ${r.entity || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Log Aktivitas</h1>
        <p className="text-sm text-ink-muted">Jejak semua perubahan penting: penjualan, kas, produk, dan pengaturan akun.</p>
      </div>

      <Input placeholder="Cari aktivitas atau nama pengguna..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card>
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : filtered.length === 0 ? (
          <EmptyState text="Belum ada aktivitas tercatat." />
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="flex items-start justify-between text-sm py-2 border-b border-border last:border-0">
                <div>
                  <p className="font-medium">{ACTION_LABEL[r.action] || r.action}</p>
                  <p className="text-xs text-ink-muted">{r.profiles?.full_name || "Sistem"} · {r.entity}</p>
                </div>
                <span className="text-xs text-ink-muted whitespace-nowrap">{formatDateTime(r.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
