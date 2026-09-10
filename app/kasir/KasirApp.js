"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatNumber } from "@/lib/format";
import { getPriceVariants } from "@/lib/pricing";
import { logActivity } from "@/lib/logActivity";
import { openCashDrawer } from "@/lib/cashDrawer";
import { useScanner, BARCODE_EVENT } from "@/components/ScannerProvider";
import ScannerStatusWidget from "@/components/ScannerStatusWidget";
import { speakProductName, isVoiceEnabled, setVoiceEnabled } from "@/lib/voice";

import OpeningCashModal from "./components/OpeningCashModal";
import CloseShiftModal from "./components/CloseShiftModal";
import VariantPickerModal from "./components/VariantPickerModal";
import QtyModal from "./components/QtyModal";
import PaymentModal from "./components/PaymentModal";
import PendingListModal from "./components/PendingListModal";
import CameraScannerModal from "./components/CameraScannerModal";
import { Volume2, VolumeX, Search, Hash, PauseCircle, RotateCcw, CreditCard, PackageOpen } from "lucide-react";

export default function KasirApp({ profile, isAdminAccount, impersonating, initialShift, products, customers, settings, pendingTransactions }) {
  const supabase = createClient();
  const router = useRouter();

  const DEFAULT_HOTKEYS = { search: "F2", qty: "F4", hold: "F7", recall: "F8", pay: "F12", drawer: "F6" };
  const hotkeys = { ...DEFAULT_HOTKEYS, ...(settings?.action_hotkeys || {}) };

  const SYSTEM_ACTIONS = [
    { key: "search", label: "Cari Barang", icon: Search },
    { key: "qty", label: "Ubah Qty", icon: Hash },
    { key: "hold", label: "Tahan Transaksi", icon: PauseCircle },
    { key: "recall", label: "Panggil Transaksi Ditahan", icon: RotateCcw },
    { key: "pay", label: "Bayar", icon: CreditCard },
    { key: "drawer", label: "Buka Laci", icon: PackageOpen },
  ];

  const [shift, setShift] = useState(initialShift);
  const [openingLoading, setOpeningLoading] = useState(false);

  const [cart, setCart] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [search, setSearch] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [customerId, setCustomerId] = useState("");

  const [variantProduct, setVariantProduct] = useState(null);
  const [qtyModalItem, setQtyModalItem] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [pendingList, setPendingList] = useState(pendingTransactions || []);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const { physicalActive, phoneConnected } = useScanner();
  const [voiceOn, setVoiceOn] = useState(true);

  useEffect(() => {
    setVoiceOn(isVoiceEnabled());
  }, []);

  const searchRef = useRef(null);

  const customer = customers.find((c) => c.id === customerId);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.sku || "").toLowerCase().includes(q) ||
          (p.product_barcodes || []).some((b) => b.barcode.toLowerCase() === q)
      )
      .slice(0, 8);
  }, [search, products]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const discountPercent = customer?.discount_percent || 0;
    const discount = Math.round((subtotal * discountPercent) / 100);
    const delivery = parseFloat(deliveryFee) || 0;
    const total = Math.max(0, subtotal - discount + delivery);
    return { subtotal, discount, delivery, total };
  }, [cart, customer, deliveryFee]);

  // ---------- Tambah item ke keranjang ----------
  const addToCart = useCallback((product, variant) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product_id === product.id && i.price_type === variant.price_type);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key: `${product.id}-${variant.price_type}-${Date.now()}`,
          product_id: product.id,
          name: product.name,
          price_type: variant.price_type,
          unit_price: variant.unit_price,
          stock_factor: variant.stock_factor,
          cost_price: Number(variant.cost_basis ?? product.cost_price ?? 0),
          qty: 1,
        },
      ];
    });
    setSearch("");
    toast.success(`${product.name} ditambahkan`, { id: "add-item" });
    speakProductName(product.name);
  }, []);

  function handlePickProduct(product) {
    const variants = getPriceVariants(product);
    if (variants.length === 1) {
      addToCart(product, variants[0]);
    } else {
      setVariantProduct(product);
    }
  }

  async function handleBarcodeInput(code) {
    // Cek dulu di data yang sudah dimuat (cepat, tanpa jaringan)
    let product = products.find(
      (p) => p.sku === code || (p.product_barcodes || []).some((b) => b.barcode === code)
    );

    // Kalau tidak ketemu (mis. barang baru ditambahkan admin setelah kasir login),
    // cek langsung ke database supaya tidak kelewat karena data di layar sudah usang.
    if (!product) {
      const { data } = await supabase
        .from("products")
        .select(
          "*, product_wholesale_pricing(*), product_kg_pricing(*), product_out_of_town_pricing(*), product_barcodes(*)"
        )
        .eq("active", true)
        .eq("sku", code);
      const fresh = (data || []).find(
        (p) => p.sku === code || (p.product_barcodes || []).some((b) => b.barcode === code)
      );
      if (fresh) {
        product = fresh;
        products.push(fresh); // simpan supaya scan berikutnya untuk barang sama tidak perlu query lagi
      } else {
        // barcode custom (product_barcodes) tidak bisa dicek lewat kolom sku, cek terpisah
        const { data: viaBarcode } = await supabase
          .from("products")
          .select(
            "*, product_wholesale_pricing(*), product_kg_pricing(*), product_out_of_town_pricing(*), product_barcodes!inner(*)"
          )
          .eq("active", true)
          .eq("product_barcodes.barcode", code)
          .maybeSingle();
        if (viaBarcode) {
          product = viaBarcode;
          products.push(viaBarcode);
        }
      }
    }

    if (product) {
      handlePickProduct(product);
    } else {
      toast.error(`Barcode "${code}" tidak ditemukan`);
    }
  }

  // ---------- Scan barcode global (fisik & HP via QR) ----------
  useEffect(() => {
    function onBarcodeEvent(e) {
      const code = e.detail?.code;
      if (code) handleBarcodeInput(code);
    }
    window.addEventListener(BARCODE_EVENT, onBarcodeEvent);
    return () => window.removeEventListener(BARCODE_EVENT, onBarcodeEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  // ---------- Shortkey kasir ----------
  useEffect(() => {
    function onKeydownGlobal(e) {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";
      const pressed = e.key.toUpperCase();
      const match = (name) => pressed === (hotkeys[name] || "").toUpperCase();

      if (match("search")) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (match("qty")) {
        e.preventDefault();
        if (selectedIndex >= 0 && cart[selectedIndex]) setQtyModalItem(cart[selectedIndex]);
      } else if (match("hold")) {
        e.preventDefault();
        holdTransaction();
      } else if (match("recall")) {
        e.preventDefault();
        setPendingOpen(true);
      } else if (match("pay")) {
        e.preventDefault();
        if (cart.length > 0) setPaymentOpen(true);
      } else if (match("drawer")) {
        e.preventDefault();
        openCashDrawer().catch((err) => toast.error(err.message));
      } else if (e.key === "ArrowDown" && !isTyping) {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(cart.length - 1, i + 1));
      } else if (e.key === "ArrowUp" && !isTyping) {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "Delete") {
        if (selectedIndex >= 0) {
          e.preventDefault();
          removeItem(selectedIndex);
        }
      } else if (e.key === "Escape") {
        if (cart.length > 0) {
          e.preventDefault();
          if (confirm("Batalkan seluruh keranjang belanja?")) resetCart();
        }
      }
    }

    window.addEventListener("keydown", onKeydownGlobal);
    return () => window.removeEventListener("keydown", onKeydownGlobal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, selectedIndex, hotkeys]);

  function removeItem(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(-1);
  }

  function resetCart() {
    setCart([]);
    setSelectedIndex(-1);
    setDeliveryFee("");
    setCustomerId("");
  }

  function updateQty(index, newQty) {
    setCart((prev) => prev.map((it, i) => (i === index ? { ...it, qty: newQty } : it)));
  }

  function changeCartItemVariant(index, priceType) {
    const item = cart[index];
    const product = products.find((p) => p.id === item.product_id);
    if (!product) return;
    const variant = getPriceVariants(product).find((v) => v.price_type === priceType);
    if (!variant) return;
    setCart((prev) =>
      prev.map((it, i) =>
        i === index
          ? {
              ...it,
              price_type: variant.price_type,
              unit_price: variant.unit_price,
              stock_factor: variant.stock_factor,
              cost_price: Number(variant.cost_basis ?? it.cost_price ?? 0),
            }
          : it
      )
    );
  }

  // ---------- Mulai shift ----------
  async function handleOpenShift(notes) {
    setOpeningLoading(true);
    try {
      const { data, error } = await supabase
        .from("shifts")
        .insert({
          cashier_id: profile.id,
          opening_cash: profile.default_opening_cash,
          notes,
        })
        .select()
        .single();
      if (error) throw error;
      setShift(data);
      await logActivity(supabase, { userId: profile.id, action: "open_shift", entity: "shifts", entityId: data.id });
      toast.success("Shift dimulai");
    } catch (err) {
      toast.error(err.message || "Gagal memulai shift");
    } finally {
      setOpeningLoading(false);
    }
  }

  // ---------- Tahan transaksi (F7) ----------
  async function holdTransaction() {
    if (cart.length === 0) return;
    try {
      const { data: tx, error } = await supabase
        .from("transactions")
        .insert({
          shift_id: shift.id,
          cashier_id: profile.id,
          customer_id: customerId || null,
          subtotal: totals.subtotal,
          discount: totals.discount,
          delivery_fee: totals.delivery,
          total: totals.total,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;

      const items = cart.map((i) => ({
        transaction_id: tx.id,
        product_id: i.product_id,
        price_type: i.price_type,
        qty: i.qty,
        unit_price: i.unit_price,
        cost_price_snapshot: i.cost_price,
        subtotal: i.unit_price * i.qty,
      }));
      const { error: itemErr } = await supabase.from("transaction_items").insert(items);
      if (itemErr) throw itemErr;

      setPendingList((prev) => [{ ...tx, transaction_items: items }, ...prev]);
      resetCart();
      toast.success("Transaksi ditahan (F8 untuk memanggil kembali)");
    } catch (err) {
      toast.error(err.message || "Gagal menahan transaksi");
    }
  }

  function recallTransaction(tx) {
    const items = (tx.transaction_items || []).map((it) => {
      const product = products.find((p) => p.id === it.product_id);
      return {
        key: `${it.product_id}-${it.price_type}-${Date.now()}-${Math.random()}`,
        product_id: it.product_id,
        name: product?.name || "(barang tidak dikenal)",
        price_type: it.price_type,
        unit_price: it.unit_price,
        stock_factor: getPriceVariants(product || {}).find((v) => v.price_type === it.price_type)?.stock_factor || 1,
        cost_price: it.cost_price_snapshot,
        qty: it.qty,
      };
    });
    setCart(items);
    setCustomerId(tx.customer_id || "");
    setDeliveryFee(tx.delivery_fee ? String(tx.delivery_fee) : "");
    setPendingList((prev) => prev.filter((t) => t.id !== tx.id));
    setPendingOpen(false);

    // Hapus record pending dari database karena sudah ditarik kembali ke keranjang
    supabase.from("transactions").delete().eq("id", tx.id).then(() => {});
  }

  // ---------- Checkout (F12 submit) ----------
  async function handleCheckout({ method, paid, change }) {
    // Cegah menjual melebihi stok yang tersedia — jangan pernah izinkan checkout kalau begitu.
    const insufficient = [];
    for (const i of cart) {
      const product = products.find((p) => p.id === i.product_id);
      const qtyOut = i.qty * i.stock_factor;
      if (product && qtyOut > Number(product.stock_qty)) {
        insufficient.push(`${product.name} (stok ${formatNumber(product.stock_qty, 2)}, diminta ${formatNumber(qtyOut, 2)})`);
      }
    }
    if (insufficient.length > 0) {
      toast.error(`Stok tidak cukup: ${insufficient.join(", ")}`, { duration: 5000 });
      return;
    }

    // Cegah kasbon melebihi limit pelanggan (kalau limit diatur, 0 = tanpa batas)
    if (method === "kasbon" && customer?.kasbon_limit > 0) {
      const { data: existingKasbon } = await supabase
        .from("kasbon")
        .select("amount, paid_amount")
        .eq("customer_id", customer.id)
        .eq("status", "belum_lunas");
      const currentOutstanding = (existingKasbon || []).reduce((s, k) => s + (Number(k.amount) - Number(k.paid_amount)), 0);
      if (currentOutstanding + totals.total > Number(customer.kasbon_limit)) {
        toast.error(
          `Melebihi limit kasbon pelanggan (limit ${formatRupiah(customer.kasbon_limit)}, sudah ada hutang ${formatRupiah(currentOutstanding)})`,
          { duration: 5000 }
        );
        return;
      }
    }

    setCheckoutLoading(true);
    try {
      const { data: tx, error } = await supabase
        .from("transactions")
        .insert({
          shift_id: shift.id,
          cashier_id: profile.id,
          customer_id: customerId || null,
          subtotal: totals.subtotal,
          discount: totals.discount,
          delivery_fee: totals.delivery,
          total: totals.total,
          payment_method: method,
          paid_amount: paid,
          change_amount: change,
          status: "completed",
          is_kasbon: method === "kasbon",
        })
        .select()
        .single();
      if (error) throw error;

      const items = cart.map((i) => ({
        transaction_id: tx.id,
        product_id: i.product_id,
        price_type: i.price_type,
        qty: i.qty,
        unit_price: i.unit_price,
        cost_price_snapshot: i.cost_price,
        subtotal: i.unit_price * i.qty,
      }));
      const { error: itemErr } = await supabase.from("transaction_items").insert(items);
      if (itemErr) throw itemErr;

      // kurangi stok + catat pergerakan stok
      for (const i of cart) {
        const product = products.find((p) => p.id === i.product_id);
        const qtyOut = i.qty * i.stock_factor;
        await supabase
          .from("products")
          .update({ stock_qty: Math.max(0, Number(product?.stock_qty || 0) - qtyOut) })
          .eq("id", i.product_id);
        await supabase.from("stock_movements").insert({
          product_id: i.product_id,
          movement_type: "penjualan",
          qty: -qtyOut,
          note: `Transaksi ${tx.id}`,
          created_by: profile.id,
        });
        if (product) product.stock_qty = Math.max(0, Number(product.stock_qty || 0) - qtyOut);
      }

      if (method === "kasbon" && customerId) {
        await supabase.from("kasbon").insert({
          customer_id: customerId,
          transaction_id: tx.id,
          amount: totals.total,
        });
      }

      await logActivity(supabase, {
        userId: profile.id,
        action: "checkout",
        entity: "transactions",
        entityId: tx.id,
        details: { total: totals.total, method },
      });

      toast.success("Transaksi berhasil!");
      resetCart();
      setPaymentOpen(false);
    } catch (err) {
      toast.error(err.message || "Gagal menyelesaikan transaksi");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleLogout() {
    if (impersonating) {
      // Admin sedang membuka kasir atas nama akun lain — kembali ke halaman pilih kasir,
      // JANGAN sign-out karena sesi login sesungguhnya tetap admin.
      router.push("/admin/kasir");
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!shift) {
    return <OpeningCashModal amount={profile.default_opening_cash} onConfirm={handleOpenShift} loading={openingLoading} />;
  }

  return (
    <div className="flex flex-1 h-screen overflow-hidden bg-background">
      {/* SIDEBAR: hanya shortkey, diatur admin */}
      <aside className="w-56 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <p className="text-sm font-semibold truncate">{settings?.store_name || "Toko"}</p>
          <p className="text-xs text-ink-muted truncate">{profile.full_name}</p>
          {impersonating && <p className="text-[10px] text-primary mt-0.5">Dibuka oleh admin</p>}
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`h-2 w-2 rounded-full ${physicalActive || phoneConnected ? "bg-primary" : "bg-danger"}`} />
            <span className="text-[11px] text-ink-muted">
              Scanner {physicalActive || phoneConnected ? "Terhubung" : "Terputus"}
            </span>
          </div>
          <div className="mt-2">
            <ScannerStatusWidget />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {/* Shortcut Aksi Sistem: F2/F4/F7/F8/F12/F6, bisa diatur admin */}
          <div className="flex items-center justify-between px-1 mb-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Shortcut Aksi</p>
            <span className="text-[10px] text-ink-muted italic">diatur admin</span>
          </div>
          <div className="space-y-1">
            {SYSTEM_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.key} className="w-full flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm bg-background">
                  <Icon size={15} className="text-ink-muted shrink-0" />
                  <span className="flex-1 truncate">{a.label}</span>
                  <span className="kbd shrink-0">{hotkeys[a.key]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t border-border space-y-1.5">
          <button
            onClick={() => {
              const next = !voiceOn;
              setVoiceOn(next);
              setVoiceEnabled(next);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background"
          >
            {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
            Suara Nama Barang: {voiceOn ? "Aktif" : "Mati"}
          </button>
          <button
            onClick={() => setCameraOpen(true)}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background"
          >
            Scan via Kamera HP
          </button>
          <button
            onClick={() => {
              if (cart.length > 0) {
                toast.error(`Selesaikan atau tahan (${hotkeys.hold}) keranjang dahulu sebelum menutup shift`);
                return;
              }
              setCloseShiftOpen(true);
            }}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background"
          >
            Tutup Shift
          </button>
          <button onClick={handleLogout} className="w-full rounded-lg px-3 py-2 text-xs font-medium text-danger hover:bg-danger-soft">
            {impersonating ? "Kembali (Tanpa Tutup Shift)" : "Keluar (Tanpa Tutup Shift)"}
          </button>
          {isAdminAccount && (
            <button
              onClick={() => router.push("/admin/dashboard")}
              className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background"
            >
              ← Kembali ke Admin
            </button>
          )}
        </div>
      </aside>

      {/* AREA KERANJANG */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border bg-surface flex items-center gap-3">
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchResults[0]) handlePickProduct(searchResults[0]);
            }}
            placeholder={`Cari nama barang... (${hotkeys.search})`}
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none max-w-[180px]"
          >
            <option value="">Pelanggan Umum</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {searchResults.length > 0 && (
          <div className="border-b border-border bg-surface px-4 py-2 flex gap-2 overflow-x-auto">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePickProduct(p)}
                className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs hover:border-primary hover:bg-primary-soft"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-ink-muted ml-1.5">{formatRupiah(p.sell_price)}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface border-b border-border text-xs text-ink-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Barang</th>
                <th className="text-left px-4 py-2 font-medium">Jenis</th>
                <th className="text-right px-4 py-2 font-medium">Harga</th>
                <th className="text-right px-4 py-2 font-medium">Qty</th>
                <th className="text-right px-4 py-2 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item, index) => (
                <tr
                  key={item.key}
                  onClick={() => setSelectedIndex(index)}
                  className={`border-b border-border cursor-pointer ${
                    selectedIndex === index ? "bg-primary-soft" : "hover:bg-background"
                  }`}
                >
                  <td className="px-4 py-2.5">{item.name}</td>
                  <td className="px-4 py-2.5 text-xs" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={item.price_type}
                      onChange={(e) => changeCartItemVariant(index, e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/40 max-w-[150px]"
                    >
                      {getPriceVariants(products.find((p) => p.id === item.product_id) || {}).map((v) => (
                        <option key={v.price_type} value={v.price_type}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">{formatRupiah(item.unit_price)}</td>
                  <td className="px-4 py-2.5 text-right">{formatNumber(item.qty, 2)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatRupiah(item.unit_price * item.qty)}</td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-ink-muted py-16 text-sm">
                    Keranjang kosong. Cari barang atau gunakan shortcut / scan barcode.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Ringkasan & shortkey */}
        <div className="border-t border-border bg-surface p-4">
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm text-ink-muted whitespace-nowrap">Biaya Antar</label>
            <input
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              inputMode="numeric"
              placeholder="0"
              className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex-1" />
            <div className="text-right">
              <p className="text-xs text-ink-muted">Total</p>
              <p className="text-xl font-semibold">{formatRupiah(totals.total)}</p>
            </div>
            <button
              onClick={() => cart.length > 0 && setPaymentOpen(true)}
              disabled={cart.length === 0}
              className="bg-primary text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-40"
            >
              Bayar ({hotkeys.pay})
            </button>
          </div>
        </div>
      </main>

      {variantProduct && (
        <VariantPickerModal
          product={variantProduct}
          onPick={(v) => {
            addToCart(variantProduct, v);
            setVariantProduct(null);
          }}
          onClose={() => setVariantProduct(null)}
        />
      )}

      {qtyModalItem && (
        <QtyModal
          item={qtyModalItem}
          onConfirm={(n) => {
            updateQty(selectedIndex, n);
            setQtyModalItem(null);
          }}
          onClose={() => setQtyModalItem(null)}
        />
      )}

      {paymentOpen && (
        <PaymentModal
          total={totals.total}
          customer={customer}
          settings={settings}
          hotkeyLabel={hotkeys.pay}
          onClose={() => setPaymentOpen(false)}
          onSubmit={handleCheckout}
          loading={checkoutLoading}
        />
      )}

      {pendingOpen && (
        <PendingListModal
          transactions={pendingList}
          hotkeyLabel={hotkeys.recall}
          onRecall={recallTransaction}
          onClose={() => setPendingOpen(false)}
        />
      )}

      {cameraOpen && (
        <CameraScannerModal
          onDetected={(code) => {
            setCameraOpen(false);
            handleBarcodeInput(code);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {closeShiftOpen && (
        <CloseShiftModal
          shift={shift}
          onClose={() => setCloseShiftOpen(false)}
          onClosed={async () => {
            await handleLogout();
          }}
        />
      )}
    </div>
  );
}
