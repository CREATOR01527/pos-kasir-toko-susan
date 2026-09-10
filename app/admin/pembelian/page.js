"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDate, formatDateTime } from "@/lib/format";
import { logActivity } from "@/lib/logActivity";
import { Button, Card, Input, Modal, Select, Textarea, EmptyState, Badge } from "@/components/ui/kit";
import { useBarcodeScan } from "@/lib/useBarcodeScan";

// Susunan kolom tingkatan harga per tipe produk, lengkap dengan modal & harga jual
// yang sudah ada di data produk (jadi tidak perlu diketik ulang, cukup lihat sebagai
// pembanding "harga lama" saat mengisi "harga baru").
function tiersForProduct(product) {
  if (!product) return [];
  if (product.unit_type === "kg") {
    const k = product.product_kg_pricing?.[0] || product.product_kg_pricing || {};
    return [
      { price_type: "kg", label: "Per Kg", info: null, stockFactor: 1, oldCost: k.cost_per_kg, oldSell: k.price_per_kg },
      { price_type: "half_kg", label: "Per 1/2 Kg", info: null, stockFactor: 0.5, oldCost: k.cost_per_half_kg, oldSell: k.price_per_half_kg },
      { price_type: "ons", label: "Per Ons", info: null, stockFactor: 0.1, oldCost: k.cost_per_ons, oldSell: k.price_per_ons },
    ];
  }
  const w = product.product_wholesale_pricing?.[0] || product.product_wholesale_pricing || {};
  return [
    { price_type: "retail", label: "Eceran", info: null, stockFactor: 1, oldCost: product.cost_price, oldSell: product.sell_price },
    {
      price_type: "grosir",
      label: "Grosir",
      info: w.wholesale_qty ? `Isi ${w.wholesale_qty} pcs (dari data produk)` : "Isi belum diatur di data produk",
      stockFactor: w.wholesale_qty || 1,
      oldCost: w.wholesale_cost_price,
      oldSell: w.wholesale_price,
    },
    {
      price_type: "half_grosir",
      label: "Setengah Grosir",
      info: w.half_wholesale_qty ? `Isi ${w.half_wholesale_qty} pcs (dari data produk)` : "Isi belum diatur di data produk",
      stockFactor: w.half_wholesale_qty || 1,
      oldCost: w.half_wholesale_cost_price,
      oldSell: w.half_wholesale_price,
    },
  ];
}

export default function PembelianPage() {
  const supabase = createClient();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [receiveOrder, setReceiveOrder] = useState(null);
  const [payOrder, setPayOrder] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ supplier_id: "", due_date: "", notes: "", discount: "0", down_payment: "0" });
  const [items, setItems] = useState([]);
  const [draftProductId, setDraftProductId] = useState("");
  const [draftTiers, setDraftTiers] = useState({}); // { [price_type]: { qty, newCost, newSell } }

  useEffect(() => {
    load();
  }, []);

  useBarcodeScan((code) => {
    if (!modalOpen) return;
    const match = products.find(
      (p) => p.sku === code || (p.product_barcodes || []).some((b) => b.barcode === code)
    );
    if (!match) return toast.error(`Barcode "${code}" tidak ditemukan`, { id: "scan-pembelian" });
    setDraftProductId(match.id);
    setDraftTiers({});
    toast.success(`Terpilih: ${match.name}`, { id: "scan-pembelian" });
  });

  async function load() {
    setLoading(true);
    const [{ data: o }, { data: s }, { data: p }] = await Promise.all([
      supabase.from("purchase_orders").select("*, suppliers(name), purchase_order_items(*, products(name))").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name").eq("active", true).order("name"),
      supabase
        .from("products")
        .select(
          "id, name, unit_type, stock_qty, cost_price, sell_price, sku, product_barcodes(barcode), product_wholesale_pricing(*), product_kg_pricing(*)"
        )
        .eq("active", true)
        .order("name"),
    ]);
    setOrders(o || []);
    setSuppliers(s || []);
    setProducts(p || []);
    setLoading(false);
  }

  const subtotal = useMemo(() => items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_cost), 0), [items]);
  const total = Math.max(0, subtotal - (Number(form.discount) || 0));
  const remaining = Math.max(0, total - (Number(form.down_payment) || 0));

  const selectedProduct = products.find((p) => p.id === draftProductId);
  const tiers = tiersForProduct(selectedProduct);

  function updateDraftTier(priceType, field, value) {
    setDraftTiers((prev) => ({ ...prev, [priceType]: { ...prev[priceType], [field]: value } }));
  }

  function addItem() {
    if (!draftProductId) return toast.error("Pilih barang dahulu");
    const rowsToAdd = [];
    for (const tier of tiers) {
      const draft = draftTiers[tier.price_type];
      const qty = Number(draft?.qty) || 0;
      if (qty <= 0) continue; // tingkatan yang tidak diisi jumlahnya, dilewati
      const newCost = draft?.newCost !== undefined && draft?.newCost !== "" ? Number(draft.newCost) : null;
      const newSell = draft?.newSell !== undefined && draft?.newSell !== "" ? Number(draft.newSell) : null;
      const unitCost = newCost !== null ? newCost : Number(tier.oldCost || 0);
      rowsToAdd.push({
        product_id: draftProductId,
        name: selectedProduct.name,
        price_type: tier.price_type,
        price_type_label: tier.label,
        qty,
        unit_cost: unitCost,
        old_cost: Number(tier.oldCost || 0),
        new_sell_price: newSell,
        old_sell_price: Number(tier.oldSell || 0),
      });
    }
    if (rowsToAdd.length === 0) return toast.error("Isi jumlah diterima di minimal satu tingkatan harga");
    setItems([...items, ...rowsToAdd]);
    setDraftProductId("");
    setDraftTiers({});
  }

  function removeItem(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function submitOrder() {
    if (!form.supplier_id || items.length === 0) return toast.error("Pilih supplier dan tambahkan minimal 1 barang");
    if ((Number(form.down_payment) || 0) > total) {
      return toast.error("Uang muka tidak boleh lebih besar dari total pesanan");
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: order, error } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: form.supplier_id,
          due_date: form.due_date || null,
          notes: form.notes || null,
          subtotal,
          discount: Number(form.discount) || 0,
          down_payment: Number(form.down_payment) || 0,
          total,
          remaining_debt: remaining,
          created_by: userData?.user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      const rows = items.map((i) => ({
        purchase_order_id: order.id,
        product_id: i.product_id,
        price_type: i.price_type,
        qty: i.qty,
        unit_cost: i.unit_cost,
        new_sell_price: i.new_sell_price,
        subtotal: i.qty * i.unit_cost,
      }));
      await supabase.from("purchase_order_items").insert(rows);
      await logActivity(supabase, { userId: userData?.user?.id, action: "create_purchase_order", entity: "purchase_orders", entityId: order.id });

      toast.success("Pesanan pembelian dibuat");
      setModalOpen(false);
      setForm({ supplier_id: "", due_date: "", notes: "", discount: "0", down_payment: "0" });
      setItems([]);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitSupplierPayment() {
    const amount = Number(payAmount) || 0;
    if (amount <= 0) return toast.error("Isi nominal pembayaran");
    if (amount > Number(payOrder.remaining_debt)) {
      return toast.error(`Nominal melebihi sisa hutang (${formatRupiah(payOrder.remaining_debt)}). Periksa kembali.`);
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("supplier_payments").insert({
        purchase_order_id: payOrder.id,
        amount,
        method: payMethod,
        paid_by: userData?.user?.id,
      });
      const newRemaining = Number(payOrder.remaining_debt) - amount;
      const patch = { remaining_debt: newRemaining };
      if (newRemaining <= 0) patch.payoff_method = payMethod;
      await supabase.from("purchase_orders").update(patch).eq("id", payOrder.id);
      await logActivity(supabase, { userId: userData?.user?.id, action: "pay_supplier_debt", entity: "purchase_orders", entityId: payOrder.id, details: { amount, method: payMethod } });
      toast.success("Pembayaran hutang dicatat");
      setPayOrder(null);
      setPayAmount("");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Menerima barang: stok bertambah dalam satuan dasar (pcs/kg), harga modal per
  // tingkatan diperbarui sesuai yang dibeli, dan harga jual ikut diperbarui HANYA
  // kalau admin mengisi "harga baru" saat membuat pesanan (kosong = tidak berubah).
  async function markReceived(order) {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      for (const item of order.purchase_order_items) {
        const product = products.find((p) => p.id === item.product_id);
        if (!product) continue;
        const tier = tiersForProduct(product).find((t) => t.price_type === item.price_type);
        const stockIncrement = Number(item.qty) * (tier?.stockFactor || 1);
        const newStock = Number(product.stock_qty || 0) + stockIncrement;

        const productPatch = { stock_qty: newStock };
        const w = product.product_wholesale_pricing?.[0] || product.product_wholesale_pricing || {};
        const k = product.product_kg_pricing?.[0] || product.product_kg_pricing || {};
        const newSell = item.new_sell_price;

        if (item.price_type === "retail") {
          productPatch.cost_price = item.unit_cost;
          if (newSell) productPatch.sell_price = newSell;
        } else if (item.price_type === "grosir") {
          await supabase.from("product_wholesale_pricing").upsert({
            product_id: product.id, ...w,
            wholesale_cost_price: item.unit_cost,
            ...(newSell ? { wholesale_price: newSell } : {}),
          });
        } else if (item.price_type === "half_grosir") {
          await supabase.from("product_wholesale_pricing").upsert({
            product_id: product.id, ...w,
            half_wholesale_cost_price: item.unit_cost,
            ...(newSell ? { half_wholesale_price: newSell } : {}),
          });
        } else if (item.price_type === "kg") {
          productPatch.cost_price = item.unit_cost;
          if (newSell) productPatch.sell_price = newSell;
          await supabase.from("product_kg_pricing").upsert({
            product_id: product.id, ...k,
            cost_per_kg: item.unit_cost,
            ...(newSell ? { price_per_kg: newSell } : {}),
          });
        } else if (item.price_type === "half_kg") {
          await supabase.from("product_kg_pricing").upsert({
            product_id: product.id, ...k,
            cost_per_half_kg: item.unit_cost,
            ...(newSell ? { price_per_half_kg: newSell } : {}),
          });
        } else if (item.price_type === "ons") {
          await supabase.from("product_kg_pricing").upsert({
            product_id: product.id, ...k,
            cost_per_ons: item.unit_cost,
            ...(newSell ? { price_per_ons: newSell } : {}),
          });
        }

        await supabase.from("products").update(productPatch).eq("id", item.product_id);
        await supabase.from("stock_movements").insert({
          product_id: item.product_id,
          movement_type: "pembelian",
          qty: stockIncrement,
          unit_cost: item.unit_cost,
          supplier_id: order.supplier_id,
          note: `Pembelian PO ${order.id.slice(0, 8)} (${item.price_type})`,
          created_by: userData?.user?.id,
        });
      }
      await supabase.from("purchase_orders").update({ status: "diterima", received_at: new Date().toISOString() }).eq("id", order.id);
      await logActivity(supabase, { userId: userData?.user?.id, action: "receive_purchase_order", entity: "purchase_orders", entityId: order.id });
      toast.success("Barang diterima, stok & harga diperbarui");
      setReceiveOrder(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pembelian</h1>
          <p className="text-sm text-ink-muted">Buat pesanan ke supplier, terima barang masuk, dan pantau sisa hutang tiap nota pembelian.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Pesanan Baru</Button>
      </div>

      <Card>
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : orders.length === 0 ? (
          <EmptyState text="Belum ada pesanan pembelian." />
        ) : (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{o.suppliers?.name}</p>
                    <p className="text-xs text-ink-muted">{formatDateTime(o.created_at)} {o.due_date ? `· Jatuh tempo ${formatDate(o.due_date)}` : ""}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <Badge tone={o.status === "diterima" ? "primary" : "warning"}>{o.status === "diterima" ? "Diterima" : "Menunggu"}</Badge>
                    {Number(o.remaining_debt) <= 0 && o.payoff_method && (
                      <Badge tone="primary">LUNAS-{o.payoff_method === "transfer" ? "Transfer" : "Cash"}</Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-ink-muted mb-2">
                  {(o.purchase_order_items || []).map((it) => `${it.products?.name} x${it.qty}`).join(", ")}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-4">
                    <span>Total: <strong>{formatRupiah(o.total)}</strong></span>
                    {Number(o.remaining_debt) > 0 && (
                      <span className="text-danger">Sisa hutang: <strong>{formatRupiah(o.remaining_debt)}</strong></span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {Number(o.remaining_debt) > 0 && (
                      <Button variant="outline" onClick={() => { setPayOrder(o); setPayAmount(String(o.remaining_debt)); }}>Bayar Hutang</Button>
                    )}
                    {o.status !== "diterima" && (
                      <Button variant="outline" onClick={() => setReceiveOrder(o)}>Terima Barang</Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modalOpen && (
        <Modal title="Pesanan Pembelian Baru" onClose={() => setModalOpen(false)} wide>
          <p className="text-xs text-ink-muted mb-3">
            Stok baru bertambah setelah barang diterima, bukan saat pesanan dibuat.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <Select label="Supplier" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
              <option value="">-- pilih --</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Jatuh Tempo" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <Textarea label="Catatan" placeholder="Kirim minggu depan, faktur menyusul" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mb-4" />

          <div className="border border-border rounded-xl p-4 mb-4">
            <p className="text-sm font-medium mb-1">Barang Dipesan</p>
            <p className="text-xs text-ink-muted mb-3">Pilih barang, lalu isi jumlah yang diterima di tingkatan harga yang sesuai (bisa lebih dari satu). Kolom "Harga Baru" boleh dikosongkan kalau harga tidak berubah dari supplier.</p>

            <Select
              value={draftProductId}
              onChange={(e) => { setDraftProductId(e.target.value); setDraftTiers({}); }}
              className="mb-4"
            >
              <option value="">-- pilih barang (bisa scan barcode) --</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>

            {selectedProduct && (
              <div className="space-y-3 mb-4">
                {tiers.map((tier) => (
                  <div key={tier.price_type} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{tier.label}</p>
                      {tier.info && <span className="text-[11px] text-ink-muted">{tier.info}</span>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                      <div>
                        <label className="block text-[11px] text-ink-muted mb-1">Jumlah Diterima</label>
                        <input
                          type="number"
                          placeholder="0"
                          value={draftTiers[tier.price_type]?.qty || ""}
                          onChange={(e) => updateDraftTier(tier.price_type, "qty", e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-muted mb-1">Harga Beli Lama</label>
                        <div className="px-2 py-1.5 text-sm text-ink-muted bg-background/50 rounded-md border border-border">{formatRupiah(tier.oldCost || 0)}</div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-muted mb-1">Harga Beli Baru</label>
                        <input
                          type="number"
                          placeholder="kosongkan jika tetap"
                          value={draftTiers[tier.price_type]?.newCost || ""}
                          onChange={(e) => updateDraftTier(tier.price_type, "newCost", e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-muted mb-1">Harga Jual Lama</label>
                        <div className="px-2 py-1.5 text-sm text-ink-muted bg-background/50 rounded-md border border-border">{formatRupiah(tier.oldSell || 0)}</div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-ink-muted mb-1">Harga Jual Baru</label>
                        <input
                          type="number"
                          placeholder="kosongkan jika tetap"
                          value={draftTiers[tier.price_type]?.newSell || ""}
                          onChange={(e) => updateDraftTier(tier.price_type, "newSell", e.target.value)}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" onClick={addItem} disabled={!selectedProduct}>+ Tambah Barang</Button>

            {items.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm border-t border-border pt-1.5">
                    <span>
                      {it.name} <span className="text-ink-muted text-xs">({it.price_type_label})</span> x{it.qty}
                      {it.unit_cost !== it.old_cost && <span className="text-primary text-xs ml-1">harga beli baru</span>}
                      {it.new_sell_price && <span className="text-primary text-xs ml-1">harga jual baru</span>}
                    </span>
                    <div className="flex items-center gap-3">
                      <span>{formatRupiah(it.qty * it.unit_cost)}</span>
                      <button onClick={() => removeItem(idx)} className="text-xs text-danger">Hapus</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            <Input label="Diskon" type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} />
            <Input label="Bayar Sekarang (Uang Muka)" type="number" value={form.down_payment} onChange={(e) => setForm({ ...form, down_payment: e.target.value })} />
          </div>

          <div className="bg-background rounded-xl p-4 space-y-1 text-sm mb-4">
            <div className="flex justify-between"><span className="text-ink-muted">Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Diskon</span><span>{formatRupiah(form.discount)}</span></div>
            <div className="flex justify-between font-medium"><span>Total</span><span>{formatRupiah(total)}</span></div>
            <div className="flex justify-between text-danger"><span>Sisa Hutang</span><span>{formatRupiah(remaining)}</span></div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={submitOrder} disabled={saving}>{saving ? "Menyimpan..." : "Buat Pesanan"}</Button>
          </div>
        </Modal>
      )}

      {receiveOrder && (
        <Modal title="Konfirmasi Terima Barang" onClose={() => setReceiveOrder(null)}>
          <p className="text-sm text-ink-muted mb-4">
            Stok akan otomatis bertambah (dikonversi ke satuan dasar pcs/kg), harga modal
            per tingkatan yang dibeli diperbarui, dan harga jual ikut berubah hanya untuk
            tingkatan yang tadi diisi "Harga Baru".
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReceiveOrder(null)}>Batal</Button>
            <Button onClick={() => markReceived(receiveOrder)} disabled={saving}>{saving ? "Memproses..." : "Konfirmasi Diterima"}</Button>
          </div>
        </Modal>
      )}

      {payOrder && (
        <Modal title={`Bayar Hutang - ${payOrder.suppliers?.name}`} onClose={() => setPayOrder(null)}>
          <p className="text-sm text-ink-muted mb-3">
            Sisa hutang saat ini: <span className="font-medium text-ink">{formatRupiah(payOrder.remaining_debt)}</span>
          </p>
          <Input label="Jumlah Bayar" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="mb-3" />
          <Select label="Metode Pembayaran" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
          </Select>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPayOrder(null)}>Batal</Button>
            <Button onClick={submitSupplierPayment} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
