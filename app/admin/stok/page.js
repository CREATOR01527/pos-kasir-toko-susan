"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatNumber, formatDateTime, formatRupiah } from "@/lib/format";
import { logActivity } from "@/lib/logActivity";
import { Button, Card, Input, Select, Textarea, EmptyState, Badge } from "@/components/ui/kit";
import { useBarcodeScan } from "@/lib/useBarcodeScan";

export default function StokPage() {
  const supabase = createClient();
  const [tab, setTab] = useState("masuk");
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);

  const [inForm, setInForm] = useState({ product_id: "", qty: "", cost_price: "", supplier_id: "", note: "" });
  const [corrForm, setCorrForm] = useState({ product_id: "", qty: "", reason: "" });

  useEffect(() => {
    load();
  }, []);

  // Scan barcode global: langsung pilihkan barang yang cocok pada form yang sedang aktif (tab).
  useBarcodeScan((code) => {
    const match = products.find(
      (p) => p.sku === code || (p.product_barcodes || []).some((b) => b.barcode === code)
    );
    if (!match) return toast.error(`Barcode "${code}" tidak ditemukan`, { id: "scan-stok" });
    if (tab === "masuk") setInForm((f) => ({ ...f, product_id: match.id }));
    else setCorrForm((f) => ({ ...f, product_id: match.id }));
    toast.success(`Terpilih: ${match.name}`, { id: "scan-stok" });
  });


  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    setUserId(userData?.user?.id);
    const [{ data: p }, { data: s }, { data: m }] = await Promise.all([
      supabase.from("products").select("id, name, stock_qty, cost_price, sku, product_barcodes(barcode)").eq("active", true).order("name"),
      supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
      supabase
        .from("stock_movements")
        .select("*, products(name)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setProducts(p || []);
    setSuppliers(s || []);
    setMovements(m || []);
    setLoading(false);
  }

  async function submitIn() {
    if (!inForm.product_id || !inForm.qty) return toast.error("Pilih barang dan isi jumlah masuk");
    setSaving(true);
    try {
      const product = products.find((p) => p.id === inForm.product_id);
      const qty = Number(inForm.qty);
      const newStock = Number(product.stock_qty) + qty;
      const updates = { stock_qty: newStock };
      if (inForm.cost_price) updates.cost_price = Number(inForm.cost_price);

      await supabase.from("products").update(updates).eq("id", inForm.product_id);
      await supabase.from("stock_movements").insert({
        product_id: inForm.product_id,
        movement_type: "masuk",
        qty,
        unit_cost: inForm.cost_price ? Number(inForm.cost_price) : null,
        supplier_id: inForm.supplier_id || null,
        note: inForm.note || null,
        created_by: userId,
      });
      await logActivity(supabase, { userId, action: "stock_in", entity: "products", entityId: inForm.product_id, details: { qty } });
      toast.success("Barang masuk dicatat");
      setInForm({ product_id: "", qty: "", cost_price: "", supplier_id: "", note: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitCorrection() {
    if (!corrForm.product_id || !corrForm.qty) return toast.error("Pilih barang dan isi jumlah dikurangi");
    const product = products.find((p) => p.id === corrForm.product_id);
    const qty = Number(corrForm.qty);
    if (qty > Number(product.stock_qty)) {
      return toast.error(`Jumlah koreksi (${qty}) melebihi stok yang ada (${product.stock_qty}). Periksa kembali.`);
    }
    setSaving(true);
    try {
      const newStock = Number(product.stock_qty) - qty;

      await supabase.from("products").update({ stock_qty: newStock }).eq("id", corrForm.product_id);
      await supabase.from("stock_movements").insert({
        product_id: corrForm.product_id,
        movement_type: "koreksi",
        qty: -qty,
        note: corrForm.reason || null,
        created_by: userId,
      });
      await logActivity(supabase, { userId, action: "stock_correction", entity: "products", entityId: corrForm.product_id, details: { qty } });
      toast.success("Koreksi stok dicatat");
      setCorrForm({ product_id: "", qty: "", reason: "" });
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
        <h1 className="text-xl font-semibold">Stok & Barang Masuk</h1>
        <p className="text-sm text-ink-muted">Catat kiriman dari supplier, koreksi barang rusak, dan pantau stok yang menipis.</p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "masuk" ? "primary" : "outline"} onClick={() => setTab("masuk")}>Barang Masuk</Button>
        <Button variant={tab === "koreksi" ? "primary" : "outline"} onClick={() => setTab("koreksi")}>Koreksi / Rusak</Button>
      </div>

      {tab === "masuk" && (
        <Card title="Catat Barang Masuk">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Pilih Barang (bisa scan barcode)" value={inForm.product_id} onChange={(e) => setInForm({ ...inForm, product_id: e.target.value })}>
              <option value="">-- pilih --</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input label="Jumlah Masuk" type="number" placeholder="contoh: 25" value={inForm.qty} onChange={(e) => setInForm({ ...inForm, qty: e.target.value })} />
            <Input
              label="Modal per Unit"
              type="number"
              placeholder="0"
              value={inForm.cost_price}
              onChange={(e) => setInForm({ ...inForm, cost_price: e.target.value })}
              hint="Mengisi ini akan memperbarui harga modal barang untuk perhitungan laba."
            />
            <Select label="Supplier" value={inForm.supplier_id} onChange={(e) => setInForm({ ...inForm, supplier_id: e.target.value })}>
              <option value="">-- pilih --</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <Textarea label="Catatan" placeholder="Nota 0021 / kiriman pagi" value={inForm.note} onChange={(e) => setInForm({ ...inForm, note: e.target.value })} className="mt-3" rows={2} />
          <div className="flex justify-end mt-4">
            <Button onClick={submitIn} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Barang Masuk"}</Button>
          </div>
        </Card>
      )}

      {tab === "koreksi" && (
        <Card title="Koreksi / Barang Rusak">
          <p className="text-xs text-ink-muted mb-3">Pakai mode ini untuk barang rusak, susut, atau salah hitung.</p>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Pilih Barang (bisa scan barcode)" value={corrForm.product_id} onChange={(e) => setCorrForm({ ...corrForm, product_id: e.target.value })}>
              <option value="">-- pilih --</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input label="Jumlah Dikurangi" type="number" placeholder="contoh: 25" value={corrForm.qty} onChange={(e) => setCorrForm({ ...corrForm, qty: e.target.value })} />
          </div>
          <Textarea label="Alasan Koreksi" placeholder="Barang rusak / telur pecah / susut" value={corrForm.reason} onChange={(e) => setCorrForm({ ...corrForm, reason: e.target.value })} className="mt-3" rows={2} />
          <div className="flex justify-end mt-4">
            <Button variant="danger" onClick={submitCorrection} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Koreksi"}</Button>
          </div>
        </Card>
      )}

      <Card title="Riwayat Pergerakan Stok">
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : movements.length === 0 ? (
          <EmptyState text="Belum ada pergerakan stok." />
        ) : (
          <div className="space-y-2">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="font-medium">{m.products?.name}</p>
                  <p className="text-xs text-ink-muted">{formatDateTime(m.created_at)} {m.note ? `· ${m.note}` : ""}</p>
                </div>
                <div className="text-right">
                  <Badge tone={m.qty > 0 ? "primary" : "danger"}>{m.qty > 0 ? "+" : ""}{formatNumber(m.qty, 2)}</Badge>
                  <p className="text-xs text-ink-muted capitalize mt-0.5">{m.movement_type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
