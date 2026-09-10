"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatNumber, formatDateTime, formatDate } from "@/lib/format";
import { exportToCsv } from "@/lib/exportCsv";
import { StatCard, Card, EmptyState, Button } from "@/components/ui/kit";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [todayTx, setTodayTx] = useState([]);
  const [monthTx, setMonthTx] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [recent, setRecent] = useState([]);
  const [dailyTrend, setDailyTrend] = useState([]);
  const [todayProfit, setTodayProfit] = useState(0);
  const [supplierDebt, setSupplierDebt] = useState({ outstanding: [], totalOutstanding: 0, paidTransfer: 0, paidCash: 0 });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, () => load())
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const today = startOfDay(new Date()).toISOString();
    const monthStart = startOfMonth(new Date()).toISOString();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [{ data: tToday }, { data: tMonth }, { data: items }, { data: products }, { data: recentTx }, { data: trend }, { data: todayItems }, { data: pos }, { data: payments }] =
      await Promise.all([
        supabase.from("transactions").select("*").eq("status", "completed").gte("created_at", today),
        supabase.from("transactions").select("*").eq("status", "completed").gte("created_at", monthStart),
        supabase
          .from("transaction_items")
          .select("product_id, qty, subtotal, cost_price_snapshot, products(name)")
          .gte("created_at", monthStart),
        supabase.from("products").select("id, name, stock_qty, min_stock").eq("active", true),
        supabase
          .from("transactions")
          .select("*, profiles(full_name)")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("transactions")
          .select("created_at, total")
          .eq("status", "completed")
          .gte("created_at", sevenDaysAgo.toISOString()),
        supabase
          .from("transaction_items")
          .select("qty, subtotal, cost_price_snapshot")
          .gte("created_at", today),
        supabase
          .from("purchase_orders")
          .select("*, suppliers(name)")
          .gt("remaining_debt", 0)
          .order("created_at", { ascending: false }),
        supabase.from("supplier_payments").select("amount, method"),
      ]);

    setTodayTx(tToday || []);
    setMonthTx(tMonth || []);
    setLowStock((products || []).filter((p) => Number(p.stock_qty) <= Number(p.min_stock)));
    setRecent(recentTx || []);

    const map = new Map();
    (items || []).forEach((it) => {
      const key = it.product_id;
      const prev = map.get(key) || { name: it.products?.name || "-", qty: 0, profit: 0, revenue: 0 };
      prev.qty += Number(it.qty);
      prev.revenue += Number(it.subtotal);
      prev.profit += Number(it.subtotal) - Number(it.cost_price_snapshot) * Number(it.qty);
      map.set(key, prev);
    });
    setTopProducts(
      Array.from(map.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8)
    );

    const dayMap = new Map();
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { date: key, label: d.toLocaleDateString("id-ID", { weekday: "short" }), total: 0 });
    }
    (trend || []).forEach((t) => {
      const key = t.created_at.slice(0, 10);
      if (dayMap.has(key)) dayMap.get(key).total += Number(t.total);
    });
    setDailyTrend(Array.from(dayMap.values()));

    const profitToday = (todayItems || []).reduce(
      (s, it) => s + (Number(it.subtotal) - Number(it.cost_price_snapshot) * Number(it.qty)),
      0
    );
    setTodayProfit(profitToday);

    const paidTransfer = (payments || []).filter((p) => p.method === "transfer").reduce((s, p) => s + Number(p.amount), 0);
    const paidCash = (payments || []).filter((p) => p.method === "cash").reduce((s, p) => s + Number(p.amount), 0);
    const totalOutstanding = (pos || []).reduce((s, p) => s + Number(p.remaining_debt), 0);
    setSupplierDebt({ outstanding: pos || [], totalOutstanding, paidTransfer, paidCash });

    setLoading(false);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const { data } = await supabase
        .from("transactions")
        .select("created_at, total, subtotal, discount, delivery_fee, payment_method, status, profiles(full_name), customers(name)")
        .order("created_at", { ascending: false })
        .limit(1000);
      const rows = (data || []).map((t) => ({
        Tanggal: formatDateTime(t.created_at),
        Kasir: t.profiles?.full_name || "-",
        Pelanggan: t.customers?.name || "Umum",
        Subtotal: t.subtotal,
        Diskon: t.discount,
        BiayaAntar: t.delivery_fee,
        Total: t.total,
        Metode: t.payment_method,
        Status: t.status,
      }));
      exportToCsv(`laporan-penjualan-${formatDate(new Date())}.csv`, rows);
    } finally {
      setExporting(false);
    }
  }

  const todayRevenue = todayTx.reduce((s, t) => s + Number(t.total), 0);
  const monthRevenue = monthTx.reduce((s, t) => s + Number(t.total), 0);
  const monthProfit = topProducts.reduce((s, p) => s + p.profit, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-ink-muted">Ringkasan performa toko secara langsung.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? "Menyiapkan..." : "Ekspor Laporan (CSV)"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Penjualan Hari Ini" value={formatRupiah(todayRevenue)} hint={`${todayTx.length} transaksi`} tone="primary" />
        <StatCard label="Laba Bersih Hari Ini" value={formatRupiah(todayProfit)} tone="primary" />
        <StatCard label="Penjualan Bulan Ini" value={formatRupiah(monthRevenue)} hint={`${monthTx.length} transaksi`} />
        <StatCard label="Estimasi Laba Bulan Ini" value={formatRupiah(monthProfit)} tone="primary" />
        <StatCard label="Stok Menipis" value={lowStock.length} tone={lowStock.length > 0 ? "danger" : "default"} hint="Perlu perhatian" />
      </div>

      <Card title="Tren Penjualan 7 Hari Terakhir">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}rb` : v)} />
              <Tooltip formatter={(v) => formatRupiah(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Produk Terlaris (Bulan Ini)">
          {loading ? (
            <p className="text-sm text-ink-muted">Memuat...</p>
          ) : topProducts.length === 0 ? (
            <EmptyState text="Belum ada penjualan bulan ini." />
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-ink-muted">{formatNumber(p.qty, 2)} terjual</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatRupiah(p.revenue)}</p>
                    <p className="text-xs text-primary">+{formatRupiah(p.profit)} laba</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Transaksi Terbaru">
          {recent.length === 0 ? (
            <EmptyState text="Belum ada transaksi." />
          ) : (
            <div className="space-y-2">
              {recent.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{formatRupiah(tx.total)}</p>
                    <p className="text-xs text-ink-muted">{tx.profiles?.full_name} · {formatDateTime(tx.created_at)}</p>
                  </div>
                  <span className="text-xs text-ink-muted capitalize">{tx.payment_method}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {lowStock.length > 0 && (
        <Card title="Barang Perlu Restock">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {lowStock.map((p) => (
              <div key={p.id} className="border border-danger/30 bg-danger-soft rounded-lg p-3">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-danger">Sisa {formatNumber(p.stock_qty, 2)} (min {formatNumber(p.min_stock, 2)})</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Hutang ke Supplier">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <StatCard label="Total Hutang Belum Lunas" value={formatRupiah(supplierDebt.totalOutstanding)} tone="danger" />
          <StatCard label="Sudah Dibayar (Transfer)" value={formatRupiah(supplierDebt.paidTransfer)} />
          <StatCard label="Sudah Dibayar (Cash)" value={formatRupiah(supplierDebt.paidCash)} />
        </div>
        {supplierDebt.outstanding.length === 0 ? (
          <EmptyState text="Tidak ada hutang ke supplier yang belum lunas." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Supplier</th>
                  <th className="text-right py-2 pr-3 font-medium">Total Nota</th>
                  <th className="text-right py-2 pr-3 font-medium">Sisa Hutang</th>
                  <th className="text-left py-2 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {supplierDebt.outstanding.map((po) => (
                  <tr key={po.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">{po.suppliers?.name}</td>
                    <td className="py-2 pr-3 text-right">{formatRupiah(po.total)}</td>
                    <td className="py-2 pr-3 text-right text-danger font-medium">{formatRupiah(po.remaining_debt)}</td>
                    <td className="py-2 text-ink-muted">Belum Lunas</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-ink-muted mt-3">
          Catat pembayaran cicilan hutang supplier lewat menu Pembelian, pada nota yang bersangkutan.
        </p>
      </Card>
    </div>
  );
}
