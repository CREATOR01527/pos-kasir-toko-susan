"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDateTime, formatNumber } from "@/lib/format";
import { logActivity } from "@/lib/logActivity";
import { Button, Card, EmptyState, Input, Select, Textarea, Badge } from "@/components/ui/kit";
import { useBarcodeScan } from "@/lib/useBarcodeScan";

export default function ReturPage() {
  const supabase = createClient();
  const [tab, setTab] = useState("customer");
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ product_id: "", qty: "", reason: "", refund_amount: "", supplier_id: "" });

  useEffect(() => {
    load();
  }, []);

  // Scan barcode global: langsung pilihkan barang yang diretur.
  useBarcodeScan((code) => {
    const match = products.find(
      (p) => p.sku === code || (p.product_barcodes || []).some((b) => b.barcode === code)
    );
    if (!match) return toast.error(`Barcode "${code}" tidak ditemukan`, { id: "scan-retur" });
    setForm((f) => ({ ...f, product_id: match.id }));
    toast.success(`Terpilih: ${match.name}`, { id: "scan-retur" });
  });


  async function load() {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: r }] = await Promise.all([
      supabase.from("products").select("id, name, stock_qty, sell_price, sku, product_barcodes(barcode)").eq("active", true).order("name"),
      supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
      supabase.from("returns").select("*, products(name)").order("created_at", { ascending: false }).limit(50),
    ]);
    setProducts(p || []);
    setSuppliers(s || []);
    setReturns(r || []);
    setLoading(false);
  }

  async function submit() {
    if (!form.product_id || !form.qty) return toast.error("Pilih barang dan isi jumlah");
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const product = products.find((p) => p.id === form.product_id);
      const qty = Number(form.qty);

      await supabase.from("returns").insert({
        return_type: tab,
        product_id: form.product_id,
        qty,
        reason: form.reason || null,
        refund_amount: Number(form.refund_amount) || 0,
        reference_supplier_id: tab === "supplier" ? form.supplier_id || null : null,
        created_by: userData?.user?.id,
      });

      // retur dari pelanggan -> stok kembali bertambah; retur ke supplier -> stok berkurang
      const stockDelta = tab === "customer" ? qty : -qty;
      await supabase.from("products").update({ stock_qty: Math.max(0, Number(product.stock_qty) + stockDelta) }).eq("id", form.product_id);
      await supabase.from("stock_movements").insert({
        product_id: form.product_id,
        movement_type: "retur",
        qty: stockDelta,
        note: `Retur ${tab === "customer" ? "dari pelanggan" : "ke supplier"}: ${form.reason || "-"}`,
        created_by: userData?.user?.id,
      });

      await logActivity(supabase, { userId: userData?.user?.id, action: "return_item", entity: "returns", details: { type: tab, qty } });
      toast.success("Retur dicatat");
      setForm({ product_id: "", qty: "", reason: "", refund_amount: "", supplier_id: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Retur Barang</h1>
        <p className="text-sm text-ink-muted">Catat barang yang dikembalikan pelanggan maupun yang diretur ke supplier.</p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "customer" ? "primary" : "outline"} onClick={() => setTab("customer")}>Retur dari Pelanggan</Button>
        <Button variant={tab === "supplier" ? "primary" : "outline"} onClick={() => setTab("supplier")}>Retur ke Supplier</Button>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Pilih Barang" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">-- pilih --</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label="Jumlah" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
          {tab === "supplier" && (
            <Select label="Supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">-- pilih --</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          {tab === "customer" && (
            <Input label="Nominal Refund (opsional)" type="number" value={form.refund_amount} onChange={(e) => setForm({ ...form, refund_amount: e.target.value })} />
          )}
        </div>
        <Textarea label="Alasan Retur" placeholder="mis. barang cacat / salah kirim" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-3" rows={2} />
        <div className="flex justify-end mt-4">
          <Button onClick={submit} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Retur"}</Button>
        </div>
      </Card>

      <Card title="Riwayat Retur">
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : returns.length === 0 ? (
          <EmptyState text="Belum ada retur." />
        ) : (
          <div className="space-y-2">
            {returns.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="font-medium">{r.products?.name} <Badge tone={r.return_type === "customer" ? "primary" : "warning"} className="ml-1">{r.return_type === "customer" ? "Dari Pelanggan" : "Ke Supplier"}</Badge></p>
                  <p className="text-xs text-ink-muted">{formatDateTime(r.created_at)} {r.reason ? `· ${r.reason}` : ""}</p>
                </div>
                <div className="text-right text-xs text-ink-muted">
                  <p>{formatNumber(r.qty, 2)} unit</p>
                  {r.refund_amount > 0 && <p>{formatRupiah(r.refund_amount)}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
