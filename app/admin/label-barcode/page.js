"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Select, Toggle, EmptyState } from "@/components/ui/kit";
import { useBarcodeScan } from "@/lib/useBarcodeScan";
import { printBarcodeLabels } from "@/lib/printBarcodeLabel";
import { formatRupiah } from "@/lib/format";

export default function LabelBarcodePage() {
  const supabase = createClient();
  const [settings, setSettings] = useState(null);
  const [products, setProducts] = useState([]);
  const [barcodes, setBarcodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ product_id: "", barcode: "", note: "", editingId: null });
  const [printQty, setPrintQty] = useState({});
  const [printing, setPrinting] = useState(null);
  const [storeName, setStoreName] = useState("");

  useEffect(() => {
    load();
  }, []);

  // Scan barcode global: langsung isikan ke kolom "Kode Barcode" pada form tambah/edit.
  useBarcodeScan((code) => {
    setForm((f) => ({ ...f, barcode: code }));
    toast.success(`Kode "${code}" dimasukkan ke kolom barcode`, { id: "scan-fill" });
  });


  async function load() {
    setLoading(true);
    const [{ data: s }, { data: p }, { data: b }, { data: store }] = await Promise.all([
      supabase.from("label_settings").select("*").eq("id", 1).single(),
      supabase.from("products").select("id, name, sell_price").eq("active", true).order("name"),
      supabase.from("product_barcodes").select("*, products(name, sell_price)").order("created_at", { ascending: false }),
      supabase.from("store_settings").select("store_name").eq("id", 1).single(),
    ]);
    setSettings(s);
    setProducts(p || []);
    setBarcodes(b || []);
    setStoreName(store?.store_name || "");
    setLoading(false);
  }

  async function saveSettings(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase.from("label_settings").update(patch).eq("id", 1);
  }

  async function submitBarcode() {
    if (!form.product_id || !form.barcode) return toast.error("Pilih barang dan isi kode barcode");
    setSaving(true);
    try {
      if (form.editingId) {
        const { error } = await supabase
          .from("product_barcodes")
          .update({ product_id: form.product_id, barcode: form.barcode, note: form.note || null })
          .eq("id", form.editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_barcodes").insert({
          product_id: form.product_id,
          barcode: form.barcode,
          note: form.note || null,
        });
        if (error) throw error;
      }
      toast.success("Barcode disimpan");
      setForm({ product_id: "", barcode: "", note: "", editingId: null });
      load();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan (barcode mungkin sudah dipakai)");
    } finally {
      setSaving(false);
    }
  }

  async function handlePrint(b) {
    setPrinting(b.id);
    try {
      await printBarcodeLabels({
        storeName,
        productName: b.products?.name || "-",
        price: b.products?.sell_price ? formatRupiah(b.products.sell_price) : "",
        barcode: b.barcode,
        qty: printQty[b.id] || 1,
        labelSettings: settings,
      });
    } catch (err) {
      toast.error("Gagal mencetak: " + err.message);
    } finally {
      setPrinting(null);
    }
  }

  async function deleteBarcode(id) {
    if (!confirm("Hapus barcode ini?")) return;
    await supabase.from("product_barcodes").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Label & Barcode</h1>
        <p className="text-sm text-ink-muted">Cetak label harga untuk barang curah atau barang tanpa barcode pabrik.</p>
      </div>

      {settings && (
        <Card title="Pengaturan Label">
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Ukuran Label" value={settings.label_size} onChange={(e) => saveSettings({ label_size: e.target.value })}>
              <option value="kecil">Kecil 40 x 25 mm</option>
              <option value="sedang">Sedang 50 x 30 mm</option>
              <option value="besar">Besar 70 x 40 mm</option>
            </Select>
            <div className="space-y-3 pt-1">
              <Toggle checked={settings.show_store_name} onChange={(v) => saveSettings({ show_store_name: v })} label="Tampilkan nama toko" />
              <Toggle checked={settings.show_cheapest_wholesale_unit} onChange={(v) => saveSettings({ show_cheapest_wholesale_unit: v })} label="Tampilkan satuan grosir termurah" />
              <Toggle checked={settings.show_barcode} onChange={(v) => saveSettings({ show_barcode: v })} label="Tampilkan barcode" />
            </div>
          </div>
        </Card>
      )}

      <Card title={form.editingId ? "Edit Barcode" : "Tambah Barcode / Label"}>
        <div className="grid sm:grid-cols-3 gap-3">
          <Select label="Barang" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">-- pilih --</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label="Kode Barcode" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="mis. 899000012345" />
          <Input label="Catatan (opsional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="mis. label curah" />
        </div>
        <div className="flex justify-end gap-2 mt-3">
          {form.editingId && (
            <Button variant="outline" onClick={() => setForm({ product_id: "", barcode: "", note: "", editingId: null })}>Batal Edit</Button>
          )}
          <Button onClick={submitBarcode} disabled={saving}>{saving ? "Menyimpan..." : form.editingId ? "Simpan Perubahan" : "+ Tambah Barcode"}</Button>
        </div>
      </Card>

      <Card title="Daftar Barcode & Cetak Label">
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : barcodes.length === 0 ? (
          <EmptyState text="Belum ada barcode kustom." />
        ) : (
          <div className="space-y-2">
            {barcodes.map((b) => (
              <div key={b.id} className="flex items-center justify-between border-b border-border last:border-0 py-2 text-sm">
                <div>
                  <p className="font-medium">{b.products?.name}</p>
                  <p className="text-xs text-ink-muted font-mono">{b.barcode} {b.note ? `· ${b.note}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    placeholder="jml"
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs text-right"
                    onWheel={(e) => e.currentTarget.blur()}
                    value={printQty[b.id] || ""}
                    onChange={(e) => setPrintQty({ ...printQty, [b.id]: e.target.value })}
                  />
                  <Button variant="outline" onClick={() => handlePrint(b)} disabled={printing === b.id}>
                    {printing === b.id ? "Menyiapkan..." : "Cetak"}
                  </Button>
                  <Button variant="ghost" onClick={() => setForm({ product_id: b.product_id, barcode: b.barcode, note: b.note || "", editingId: b.id })}>Edit</Button>
                  <Button variant="danger" onClick={() => deleteBarcode(b.id)}>Hapus</Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-ink-muted mt-3">
          Tombol Cetak hanya mencetak label (nama barang, harga, dan kode batang) sesuai ukuran
          yang dipilih di atas — bukan seluruh tampilan aplikasi. Isi kolom "jml" untuk mencetak
          beberapa label sekaligus untuk barang yang sama.
        </p>
      </Card>
    </div>
  );
}
