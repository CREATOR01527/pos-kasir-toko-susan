"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatNumber, formatDateTime } from "@/lib/format";
import { Card, EmptyState, Badge, Modal, Input, Select, Button } from "@/components/ui/kit";

const PRICE_TYPE_LABELS = {
  retail: "Normal",
  grosir: "Grosir",
  half_grosir: "1/2 Grosir",
  kg: "Per Kg",
  half_kg: "Per 1/2 Kg",
  ons: "Per Ons",
  out_of_town: "Antar Luar Kota",
};

const STATUS_LABELS = { completed: "Selesai", pending: "Tertunda", void: "Dibatalkan" };
const STATUS_TONE = { completed: "primary", pending: "warning", void: "danger" };

function txCode(id) {
  return `TRX-${id.slice(0, 8).toUpperCase()}`;
}

export default function CekTransaksiPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [branches, setBranches] = useState([]);
  const [codeSearch, setCodeSearch] = useState("");

  const [detailTx, setDetailTx] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    load();
    supabase.from("branches").select("*").eq("active", true).order("name").then(({ data }) => setBranches(data || []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    let query = supabase
      .from("transactions")
      .select("*, profiles(full_name), customers(name)")
      .order("created_at", { ascending: false })
      .limit(300);

    if (dateStart) query = query.gte("created_at", new Date(`${dateStart}T00:00:00`).toISOString());
    if (dateEnd) query = query.lte("created_at", new Date(`${dateEnd}T23:59:59.999`).toISOString());
    if (statusFilter) query = query.eq("status", statusFilter);
    if (branchFilter) query = query.eq("branch_id", branchFilter);

    const { data } = await query;
    setRows(data || []);
    setLoading(false);
  }

  const filtered = codeSearch
    ? rows.filter((r) => txCode(r.id).toLowerCase().includes(codeSearch.trim().toLowerCase()))
    : rows;

  async function openDetail(tx) {
    setDetailTx(tx);
    setDetailLoading(true);
    const { data } = await supabase
      .from("transaction_items")
      .select("*, products(name)")
      .eq("transaction_id", tx.id);
    setDetailItems(data || []);
    setDetailLoading(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Cek Transaksi Penjualan</h1>
        <p className="text-sm text-ink-muted">Semua transaksi penjualan berdasarkan kode transaksi. Klik salah satu untuk lihat daftar barang yang terjual.</p>
      </div>

      <Card>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <Input label="Tanggal Mulai" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          <Input label="Tanggal Akhir" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="completed">Selesai</option>
            <option value="pending">Tertunda</option>
            <option value="void">Dibatalkan</option>
          </Select>
          {branches.length > 1 && (
            <Select label="Cabang" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">Semua Cabang</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Button onClick={load} disabled={loading}>{loading ? "Memuat..." : "Terapkan Filter"}</Button>
        </div>
        <div className="mt-3">
          <Input label="Cari Kode Transaksi" placeholder="contoh: TRX-A1B2C3D4" value={codeSearch} onChange={(e) => setCodeSearch(e.target.value)} className="max-w-xs" />
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState text="Tidak ada transaksi pada rentang/filter ini." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Kode Transaksi</th>
                  <th className="text-left py-2 pr-3 font-medium">Tanggal</th>
                  <th className="text-left py-2 pr-3 font-medium">Kasir</th>
                  <th className="text-left py-2 pr-3 font-medium">Pelanggan</th>
                  <th className="text-right py-2 pr-3 font-medium">Total Belanja</th>
                  <th className="text-left py-2 pr-3 font-medium">Metode</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => openDetail(tx)}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-background"
                  >
                    <td className="py-2 pr-3 font-medium text-primary">{txCode(tx.id)}</td>
                    <td className="py-2 pr-3 text-ink-muted">{formatDateTime(tx.created_at)}</td>
                    <td className="py-2 pr-3">{tx.profiles?.full_name || "-"}</td>
                    <td className="py-2 pr-3">{tx.customers?.name || "Umum"}</td>
                    <td className="py-2 pr-3 text-right font-medium">{formatRupiah(tx.total)}</td>
                    <td className="py-2 pr-3 capitalize">{tx.payment_method}</td>
                    <td className="py-2">
                      <Badge tone={STATUS_TONE[tx.status] || "default"}>{STATUS_LABELS[tx.status] || tx.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detailTx && (
        <Modal title={txCode(detailTx.id)} onClose={() => setDetailTx(null)}>
          <div className="text-sm text-ink-muted mb-3 space-y-0.5">
            <p>{formatDateTime(detailTx.created_at)}</p>
            <p>Kasir: {detailTx.profiles?.full_name || "-"} · Pelanggan: {detailTx.customers?.name || "Umum"}</p>
          </div>

          {detailLoading ? (
            <p className="text-sm text-ink-muted">Memuat barang...</p>
          ) : (
            <div className="space-y-1.5 mb-3">
              {detailItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-sm border-b border-border pb-1.5">
                  <div>
                    <p>{it.products?.name || "-"} <span className="text-xs text-ink-muted">({PRICE_TYPE_LABELS[it.price_type] || it.price_type})</span></p>
                    <p className="text-xs text-ink-muted">{formatNumber(it.qty, 2)} x {formatRupiah(it.unit_price)}</p>
                  </div>
                  <p className="font-medium">{formatRupiah(it.subtotal)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span>{formatRupiah(detailTx.subtotal)}</span></div>
            {Number(detailTx.discount) > 0 && <div className="flex justify-between"><span className="text-ink-muted">Diskon</span><span>-{formatRupiah(detailTx.discount)}</span></div>}
            {Number(detailTx.delivery_fee) > 0 && <div className="flex justify-between"><span className="text-ink-muted">Biaya Antar</span><span>{formatRupiah(detailTx.delivery_fee)}</span></div>}
            <div className="flex justify-between font-semibold"><span>Total Belanja</span><span>{formatRupiah(detailTx.total)}</span></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
