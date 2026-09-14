"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatNumber } from "@/lib/format";
import { Button, Card, Input, Modal, Select, Toggle, EmptyState, Badge } from "@/components/ui/kit";
import { useBarcodeScan } from "@/lib/useBarcodeScan";
import { findBarcodeConflict } from "@/lib/checkBarcodeOwner";
import { useViewport } from "@/lib/useViewport";
import { getBranchStock } from "@/lib/branchStock";
import CameraScanButton from "@/components/CameraScanButton";

const emptyForm = {
  id: null,
  name: "",
  sku: "",
  unit_type: "unit",
  cost_price: "",
  sell_price: "",
  stock_qty: "",
  min_stock: "",
  tax_rate: "",
  active: true,
  wholesale_qty: "",
  wholesale_price: "",
  wholesale_cost_price: "",
  half_wholesale_qty: "",
  half_wholesale_price: "",
  half_wholesale_cost_price: "",
  cost_per_kg: "",
  price_per_kg: "",
  cost_per_half_kg: "",
  price_per_half_kg: "",
  cost_per_ons: "",
  price_per_ons: "",
  out_of_town_price: "",
};

export default function ProdukPage() {
  const supabase = createClient();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeChoiceOpen, setTypeChoiceOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [branches, setBranches] = useState([]);
  const [activeBranch, setActiveBranch] = useState("");
  const { isMobile } = useViewport();

  useEffect(() => {
    load();
    supabase.from("branches").select("*").eq("active", true).order("created_at", { ascending: true }).then(({ data }) => {
      setBranches(data || []);
      setActiveBranch((prev) => prev || data?.[0]?.id || "");
    });
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select(
        "*, product_wholesale_pricing(*), product_kg_pricing(*), product_out_of_town_pricing(*), product_barcodes(*), product_branch_stock(*)"
      )
      .order("created_at", { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }

  // Scan barcode global: kalau form sedang terbuka, isi kolom Barcode Utama.
  // Kalau tertutup, pakai untuk langsung mencari produk di daftar.
  useBarcodeScan((code) => {
    if (modalOpen) {
      setForm((f) => ({ ...f, sku: code }));
      toast.success(`Kode "${code}" dimasukkan ke Barcode Utama`, { id: "scan-fill" });
    } else {
      setSearch(code);
    }
  });

  function startAddPcs() {
    setForm({ ...emptyForm, unit_type: "unit" });
    setTypeChoiceOpen(false);
    setModalOpen(true);
  }

  function startAddTimbang() {
    setForm({ ...emptyForm, unit_type: "kg" });
    setTypeChoiceOpen(false);
    setModalOpen(true);
  }

  function openEdit(p) {
    const w = p.product_wholesale_pricing?.[0] || p.product_wholesale_pricing || {};
    const k = p.product_kg_pricing?.[0] || p.product_kg_pricing || {};
    const oot = p.product_out_of_town_pricing?.[0] || p.product_out_of_town_pricing || {};
    const branchStock = getBranchStock(p, activeBranch);
    setForm({
      id: p.id,
      name: p.name,
      sku: p.sku || "",
      unit_type: p.unit_type,
      cost_price: p.cost_price,
      sell_price: p.sell_price,
      stock_qty: branchStock.stock_qty,
      min_stock: branchStock.min_stock,
      tax_rate: p.tax_rate || "",
      active: p.active,
      wholesale_qty: w.wholesale_qty || "",
      wholesale_price: w.wholesale_price || "",
      wholesale_cost_price: w.wholesale_cost_price || "",
      half_wholesale_qty: w.half_wholesale_qty || "",
      half_wholesale_price: w.half_wholesale_price || "",
      half_wholesale_cost_price: w.half_wholesale_cost_price || "",
      cost_per_kg: k.cost_per_kg || "",
      price_per_kg: k.price_per_kg || "",
      cost_per_half_kg: k.cost_per_half_kg || "",
      price_per_half_kg: k.price_per_half_kg || "",
      cost_per_ons: k.cost_per_ons || "",
      price_per_ons: k.price_per_ons || "",
      out_of_town_price: oot.price || "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    const isKg = form.unit_type === "kg";

    if (!form.name) return toast.error("Nama produk wajib diisi");
    if (!isKg && form.sell_price === "") return toast.error("Harga jual eceran wajib diisi");
    if (isKg && !form.price_per_kg) return toast.error("Harga jual per Kg wajib diisi");

    if (!isKg && Number(form.sell_price) < Number(form.cost_price || 0)) {
      return toast.error("Harga jual eceran tidak boleh lebih rendah dari harga modal (akan rugi)");
    }
    if (form.wholesale_price && form.wholesale_cost_price && Number(form.wholesale_price) < Number(form.wholesale_cost_price)) {
      return toast.error("Harga jual grosir tidak boleh lebih rendah dari harga beli grosir (akan rugi)");
    }
    if (form.half_wholesale_price && form.half_wholesale_cost_price && Number(form.half_wholesale_price) < Number(form.half_wholesale_cost_price)) {
      return toast.error("Harga jual setengah grosir tidak boleh lebih rendah dari harga beli setengah grosir (akan rugi)");
    }
    if (isKg && form.price_per_kg && form.cost_per_kg && Number(form.price_per_kg) < Number(form.cost_per_kg)) {
      return toast.error("Harga jual per Kg tidak boleh lebih rendah dari harga beli per Kg (akan rugi)");
    }

    if (form.name.trim()) {
      const nameTrimmed = form.name.trim();
      let nameQuery = supabase.from("products").select("id, name").ilike("name", nameTrimmed);
      if (form.id) nameQuery = nameQuery.neq("id", form.id);
      const { data: nameMatches } = await nameQuery;
      if (nameMatches && nameMatches.length > 0) {
        return toast.error(`Nama produk "${nameTrimmed}" sudah dipakai oleh produk lain. Gunakan nama lain, atau edit produk yang sudah ada.`);
      }
    }

    if (form.sku) {
      const conflict = await findBarcodeConflict(supabase, form.sku, { excludeProductId: form.id });
      if (conflict) {
        return toast.error(`Barcode "${form.sku}" sudah dipakai oleh produk "${conflict.name}". Satu barcode hanya untuk satu produk.`);
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku.trim() || null,
        unit_type: form.unit_type,
        cost_price: isKg ? Number(form.cost_per_kg) || 0 : Number(form.cost_price) || 0,
        sell_price: isKg ? Number(form.price_per_kg) || 0 : Number(form.sell_price) || 0,
        tax_rate: Math.min(100, Math.max(0, Number(form.tax_rate) || 0)),
        active: form.active,
      };

      let productId = form.id;
      if (productId) {
        const { error } = await supabase.from("products").update(payload).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(payload).select().single();
        if (error) throw error;
        productId = data.id;
      }

      // Stok disimpan PER CABANG (product_branch_stock), bukan lagi di tabel
      // products — supaya cabang lain tidak ikut berubah stoknya.
      if (activeBranch) {
        await supabase.from("product_branch_stock").upsert(
          {
            product_id: productId,
            branch_id: activeBranch,
            stock_qty: Number(form.stock_qty) || 0,
            min_stock: Number(form.min_stock) || 0,
          },
          { onConflict: "product_id,branch_id" }
        );
      }

      if (form.unit_type === "unit" && (form.wholesale_qty || form.half_wholesale_qty)) {
        await supabase.from("product_wholesale_pricing").upsert({
          product_id: productId,
          wholesale_qty: Number(form.wholesale_qty) || null,
          wholesale_price: Number(form.wholesale_price) || null,
          wholesale_cost_price: Number(form.wholesale_cost_price) || null,
          half_wholesale_qty: Number(form.half_wholesale_qty) || null,
          half_wholesale_price: Number(form.half_wholesale_price) || null,
          half_wholesale_cost_price: Number(form.half_wholesale_cost_price) || null,
        });
      }

      if (form.unit_type === "kg") {
        await supabase.from("product_kg_pricing").upsert({
          product_id: productId,
          price_per_kg: Number(form.price_per_kg) || null,
          cost_per_kg: Number(form.cost_per_kg) || null,
          price_per_half_kg: Number(form.price_per_half_kg) || null,
          cost_per_half_kg: Number(form.cost_per_half_kg) || null,
          price_per_ons: Number(form.price_per_ons) || null,
          cost_per_ons: Number(form.cost_per_ons) || null,
        });
      }

      if (form.out_of_town_price) {
        await supabase.from("product_out_of_town_pricing").upsert({
          product_id: productId,
          price: Number(form.out_of_town_price),
        });
      }

      toast.success("Produk disimpan");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message || "Gagal menyimpan produk");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Hapus produk ini?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Produk dihapus");
      load();
    }
  }

  const filtered = products.filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku || "").toLowerCase().includes(q) ||
      (p.product_barcodes || []).some((b) => b.barcode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Produk & Harga</h1>
          <p className="text-sm text-ink-muted">Kelola produk PCS (eceran/grosir/setengah grosir) dan produk timbangan (kiloan).</p>
        </div>
        <Button onClick={() => setTypeChoiceOpen(true)}>+ Tambah Produk</Button>
      </div>

      <div className="flex items-center gap-2 max-w-xs">
        <Input placeholder="Cari produk / barcode..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        {isMobile && <CameraScanButton onDetected={(code) => setSearch(code)} title="Cari produk pakai kamera" />}
      </div>

      {branches.length > 1 && (
        <Select label="Menampilkan & mengedit stok untuk cabang" value={activeBranch} onChange={(e) => setActiveBranch(e.target.value)} className="max-w-xs">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      )}

      <Card>
        {loading ? (
          <p className="text-sm text-ink-muted">Memuat...</p>
        ) : filtered.length === 0 ? (
          <EmptyState text="Belum ada produk." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Nama</th>
                  <th className="text-left py-2 pr-3 font-medium">Tipe</th>
                  <th className="text-right py-2 pr-3 font-medium">Harga Jual</th>
                  <th className="text-right py-2 pr-3 font-medium">Stok</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const branchStock = getBranchStock(p, activeBranch);
                  return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">{p.name}</td>
                    <td className="py-2.5 pr-3 text-ink-muted">{p.unit_type === "kg" ? "Timbangan" : "PCS"}</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(p.sell_price)}{p.unit_type === "kg" ? "/kg" : ""}</td>
                    <td className="py-2.5 pr-3 text-right">
                      {formatNumber(branchStock.stock_qty, 2)}
                      {branchStock.stock_qty <= branchStock.min_stock && (
                        <Badge tone="danger" className="ml-2">Menipis</Badge>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={p.active ? "primary" : "default"}>{p.active ? "Aktif" : "Nonaktif"}</Badge>
                    </td>
                    <td className="py-2.5 text-right space-x-2">
                      <Button variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
                      <Button variant="danger" onClick={() => handleDelete(p.id)}>Hapus</Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {typeChoiceOpen && (
        <Modal title="Tambah Produk — Pilih Jenis" onClose={() => setTypeChoiceOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={startAddPcs}
              className="rounded-xl border-2 border-border hover:border-primary hover:bg-primary-soft transition p-5 text-center"
            >
              <p className="text-base font-semibold mb-1">Produk PCS</p>
              <p className="text-xs text-ink-muted">Eceran, grosir, setengah grosir</p>
            </button>
            <button
              onClick={startAddTimbang}
              className="rounded-xl border-2 border-border hover:border-primary hover:bg-primary-soft transition p-5 text-center"
            >
              <p className="text-base font-semibold mb-1">Produk Timbang</p>
              <p className="text-xs text-ink-muted">Per Kg, 1/2 Kg, Ons</p>
            </button>
          </div>
        </Modal>
      )}

      {modalOpen && (
        <Modal title={form.id ? "Edit Produk" : form.unit_type === "kg" ? "Tambah Produk Timbang" : "Tambah Produk PCS"} onClose={() => setModalOpen(false)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input alignRow label="Nama Produk" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} hint="Tidak boleh sama dengan produk lain yang sudah ada." />
              <div className="grid row-span-3 [grid-template-rows:subgrid]">
                <label className="text-sm font-medium mb-1.5 leading-snug self-end">Barcode Utama / SKU</label>
                <div className="flex items-center gap-2 self-start">
                  <input
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                  />
                  {isMobile && <CameraScanButton onDetected={(code) => setForm((f) => ({ ...f, sku: code }))} title="Isi barcode pakai kamera" />}
                </div>
                <p className="text-xs text-ink-muted mt-1 self-start">Dicocokkan saat scan barcode di kasir.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                alignRow
                label={`Stok Saat Ini${branches.length > 1 ? ` — ${branches.find((b) => b.id === activeBranch)?.name || ""}` : ""}`}
                type="number"
                value={form.stock_qty}
                onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
              />
              <Input alignRow label="Stok Minimum (peringatan menipis)" type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
              <Input
                alignRow
                label="Pajak/PPN (%) — kosongkan/0 jika tidak kena pajak"
                type="number"
                value={form.tax_rate}
                onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
              />
            </div>

            {form.unit_type === "unit" ? (
              <>
                <div className="border border-border rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Harga Eceran</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input alignRow label="Harga Beli / Modal (per pcs)" type="number" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
                    <Input alignRow label="Harga Jual Eceran (per pcs)" type="number" value={form.sell_price} onChange={(e) => setForm({ ...form, sell_price: e.target.value })} />
                  </div>
                </div>

                <div className="border border-border rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Harga Grosir</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input alignRow label="Isi per Grosir (pcs)" type="number" value={form.wholesale_qty} onChange={(e) => setForm({ ...form, wholesale_qty: e.target.value })} />
                    <Input alignRow label="Harga Beli Grosir (per paket)" type="number" value={form.wholesale_cost_price} onChange={(e) => setForm({ ...form, wholesale_cost_price: e.target.value })} />
                    <Input alignRow label="Harga Jual Grosir (per paket)" type="number" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} />
                  </div>
                </div>

                <div className="border border-border rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Harga Setengah Grosir</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input alignRow label="Isi per Setengah Grosir (pcs)" type="number" value={form.half_wholesale_qty} onChange={(e) => setForm({ ...form, half_wholesale_qty: e.target.value })} />
                    <Input alignRow label="Harga Beli 1/2 Grosir (per paket)" type="number" value={form.half_wholesale_cost_price} onChange={(e) => setForm({ ...form, half_wholesale_cost_price: e.target.value })} />
                    <Input alignRow label="Harga Jual 1/2 Grosir (per paket)" type="number" value={form.half_wholesale_price} onChange={(e) => setForm({ ...form, half_wholesale_price: e.target.value })} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="border border-border rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Harga per Kg</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input alignRow label="Harga Beli per Kg" type="number" value={form.cost_per_kg} onChange={(e) => setForm({ ...form, cost_per_kg: e.target.value })} />
                    <Input alignRow label="Harga Jual per Kg" type="number" value={form.price_per_kg} onChange={(e) => setForm({ ...form, price_per_kg: e.target.value })} />
                  </div>
                </div>
                <div className="border border-border rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Harga per 1/2 Kg</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input alignRow label="Harga Beli per 1/2 Kg" type="number" value={form.cost_per_half_kg} onChange={(e) => setForm({ ...form, cost_per_half_kg: e.target.value })} />
                    <Input alignRow label="Harga Jual per 1/2 Kg" type="number" value={form.price_per_half_kg} onChange={(e) => setForm({ ...form, price_per_half_kg: e.target.value })} />
                  </div>
                </div>
                <div className="border border-border rounded-xl p-4">
                  <p className="text-sm font-medium mb-3">Harga per Ons (peronan)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input alignRow label="Harga Beli per Ons" type="number" value={form.cost_per_ons} onChange={(e) => setForm({ ...form, cost_per_ons: e.target.value })} />
                    <Input alignRow label="Harga Jual per Ons" type="number" value={form.price_per_ons} onChange={(e) => setForm({ ...form, price_per_ons: e.target.value })} />
                  </div>
                </div>
              </>
            )}

            <Input
              label="Harga Antar Luar Kota (opsional — harga khusus barang ini, bukan biaya kirim)"
              type="number"
              value={form.out_of_town_price}
              onChange={(e) => setForm({ ...form, out_of_town_price: e.target.value })}
            />

            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Produk aktif (tampil di kasir)" />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
