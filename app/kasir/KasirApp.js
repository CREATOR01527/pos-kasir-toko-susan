"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatNumber } from "@/lib/format";
import { getPriceVariants } from "@/lib/pricing";
import { logActivity } from "@/lib/logActivity";
import { openCashDrawer } from "@/lib/cashDrawer";
import { printReceipt } from "@/lib/printReceipt";
import { useScanner, BARCODE_EVENT } from "@/components/ScannerProvider";
import ScannerStatusWidget from "@/components/ScannerStatusWidget";
import { useViewport } from "@/lib/useViewport";
import { speakProductName, isVoiceEnabled, setVoiceEnabled } from "@/lib/voice";
import { normalizeBarcode, findProductByCode } from "@/lib/barcode";
import { getBranchStock } from "@/lib/branchStock";

import OpeningCashModal from "./components/OpeningCashModal";
import CloseShiftModal from "./components/CloseShiftModal";
import VariantPickerModal from "./components/VariantPickerModal";
import QtyModal from "./components/QtyModal";
import PaymentModal from "./components/PaymentModal";
import PendingListModal from "./components/PendingListModal";
import CameraScannerModal from "./components/CameraScannerModal";
import ReceiptModal from "./components/ReceiptModal";
import { Volume2, VolumeX, Search, Hash, PauseCircle, RotateCcw, CreditCard, PackageOpen, Menu, X, ScanLine, Trash2, Building2 } from "lucide-react";

export default function KasirApp({ profile, isAdminAccount, impersonating, initialShift, products, customers, settings, pendingTransactions, branches, resolvedBranchId }) {
  const supabase = createClient();
  const router = useRouter();

  // Cabang aktif untuk sesi kasir ini (menentukan stok mana yang dipakai &
  // milik cabang mana transaksi ini tercatat). Kalau belum jelas (>1 cabang
  // aktif dan akun ini belum ditugaskan ke satu cabang tertentu), kasir
  // diminta memilih dulu lewat layar penuh sebelum bisa mulai transaksi.
  const [sessionBranchId, setSessionBranchId] = useState(resolvedBranchId || null);
  const needsBranchPicker = !sessionBranchId && (branches || []).length > 0;
  const activeBranchName = (branches || []).find((b) => b.id === sessionBranchId)?.name;

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
  const [manualDiscount, setManualDiscount] = useState("");
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
  const [lastReceipt, setLastReceipt] = useState(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const { isMobile, isTablet } = useViewport();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const taxInclusive = !!settings?.tax_price_inclusive;

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const discountPercent = customer?.discount_percent || 0;
    const percentDiscount = Math.round((subtotal * discountPercent) / 100);
    const manualDiscountAmount = Math.max(0, parseFloat(manualDiscount) || 0);
    const discount = percentDiscount + manualDiscountAmount;
    const delivery = parseFloat(deliveryFee) || 0;

    // Pajak dihitung per item dari tax_rate produk masing-masing (0% = tidak
    // kena pajak). Kalau "harga sudah termasuk pajak" aktif di Pengaturan,
    // pajak cuma dipisah untuk tampilan struk (tidak menambah total bayar).
    let tax = 0;
    for (const i of cart) {
      const rate = Number(i.tax_rate || 0);
      if (rate <= 0) continue;
      const lineTotal = i.unit_price * i.qty;
      tax += taxInclusive ? lineTotal - lineTotal / (1 + rate / 100) : (lineTotal * rate) / 100;
    }
    tax = Math.round(tax);

    const total = Math.max(0, subtotal - discount + delivery + (taxInclusive ? 0 : tax));
    return { subtotal, discount, percentDiscount, manualDiscountAmount, delivery, tax, total };
  }, [cart, customer, deliveryFee, manualDiscount, taxInclusive]);

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
          tax_rate: Number(product.tax_rate || 0),
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
    const cleanCode = normalizeBarcode(code);
    if (!cleanCode) return;

    // Cek dulu di data yang sudah dimuat (cepat, tanpa jaringan)
    let product = findProductByCode(products, cleanCode);

    // Kalau tidak ketemu (mis. barang baru ditambahkan admin setelah kasir login),
    // cek langsung ke database supaya tidak kelewat karena data di layar sudah usang.
    // Pakai ilike (tanpa peduli besar/kecil huruf) supaya konsisten dengan cara
    // barcode dicocokkan di atas.
    if (!product) {
      const { data } = await supabase
        .from("products")
        .select(
          "*, product_wholesale_pricing(*), product_kg_pricing(*), product_out_of_town_pricing(*), product_barcodes(*), product_branch_stock(*)"
        )
        .eq("active", true)
        .ilike("sku", cleanCode);
      const fresh = findProductByCode(data || [], cleanCode);
      if (fresh) {
        product = fresh;
        products.push(fresh); // simpan supaya scan berikutnya untuk barang sama tidak perlu query lagi
      } else {
        // barcode custom (product_barcodes) tidak bisa dicek lewat kolom sku, cek terpisah
        const { data: viaBarcode } = await supabase
          .from("products")
          .select(
            "*, product_wholesale_pricing(*), product_kg_pricing(*), product_out_of_town_pricing(*), product_barcodes!inner(*), product_branch_stock(*)"
          )
          .eq("active", true)
          .ilike("product_barcodes.barcode", cleanCode);
        const matchedViaBarcode = (viaBarcode || [])[0];
        if (matchedViaBarcode) {
          product = matchedViaBarcode;
          products.push(matchedViaBarcode);
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
      // PENTING: kalau ada modal/popup apa saja yang sedang terbuka, JANGAN proses
      // shortcut apapun di sini. Tanpa penjagaan ini, menekan F7/F8/F12/dll saat
      // modal lain sedang terbuka (misal saat memilih varian barang atau saat
      // modal Pembayaran sudah tampil) bisa memicu modal LAIN ikut terbuka di
      // atasnya secara bertumpuk -- bug nyata yang bisa membingungkan kasir.
      // Modal yang butuh Enter/Escape sendiri (QtyModal, dll) sudah menangani
      // keyboard-nya masing-masing secara terpisah.
      const anyModalOpen =
        !!variantProduct || !!qtyModalItem || paymentOpen || pendingOpen || cameraOpen || closeShiftOpen || receiptModalOpen;
      if (anyModalOpen) return;

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
      } else if (e.key === "Delete" && !isTyping) {
        // PENTING: harus ada "&& !isTyping" di sini. Tanpa itu, menekan tombol
        // Delete SAAT SEDANG MENGETIK di kolom Diskon/Antar (untuk menghapus
        // angka ke depan kursor, cara wajar mengedit angka) akan IKUT
        // menghapus barang yang sedang terpilih di keranjang -- bug nyata
        // yang bisa bikin kasir kehilangan item tanpa sadar.
        if (selectedIndex >= 0) {
          e.preventDefault();
          removeItem(selectedIndex);
        }
      } else if (e.key === "Escape" && !isTyping) {
        // Sama seperti di atas: kalau kasir menekan Escape untuk sekadar
        // mengosongkan kolom pencarian (kolom itu sendiri sudah menangani
        // Escape-nya sendiri di onKeyDown-nya), TANPA "&& !isTyping" di sini,
        // event yang sama akan ikut "menembus" ke sini dan memunculkan
        // konfirmasi "batalkan seluruh keranjang" yang tidak diminta.
        if (cart.length > 0) {
          e.preventDefault();
          if (confirm("Batalkan seluruh keranjang belanja?")) resetCart();
        }
      }
    }

    window.addEventListener("keydown", onKeydownGlobal);
    return () => window.removeEventListener("keydown", onKeydownGlobal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, selectedIndex, hotkeys, variantProduct, qtyModalItem, paymentOpen, pendingOpen, cameraOpen, closeShiftOpen, receiptModalOpen]);

  function removeItem(index) {
    setCart((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(-1);
  }

  // ---------- Jalankan shortcut aksi lewat tap (khusus menu geser HP) ----------
  // Di desktop shortcut ini dipicu tombol fisik F2/F4/F7/F8/F12/F6 lewat
  // onKeydownGlobal di atas. Di HP tidak ada keyboard fisik, jadi daftar
  // "Shortcut Aksi" di menu geser harus bisa DITEKAN LANGSUNG supaya benar-benar
  // berfungsi, bukan cuma daftar info F-key yang tidak bisa dipakai.
  function triggerMobileShortcut(key) {
    setMobileMenuOpen(false);
    if (key === "search") {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else if (key === "qty") {
      if (selectedIndex >= 0 && cart[selectedIndex]) setQtyModalItem(cart[selectedIndex]);
      else toast.error("Pilih barang di keranjang dahulu");
    } else if (key === "hold") {
      holdTransaction();
    } else if (key === "recall") {
      setPendingOpen(true);
    } else if (key === "pay") {
      if (cart.length > 0) setPaymentOpen(true);
      else toast.error("Keranjang masih kosong");
    } else if (key === "drawer") {
      openCashDrawer().catch((err) => toast.error(err.message));
    }
  }

  function resetCart() {
    setCart([]);
    setSelectedIndex(-1);
    setDeliveryFee("");
    setManualDiscount("");
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
          branch_id: sessionBranchId,
          customer_id: customerId || null,
          subtotal: totals.subtotal,
          discount: totals.discount,
          delivery_fee: totals.delivery,
          tax_amount: totals.tax,
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
        tax_rate: Number(i.tax_rate || 0),
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
        tax_rate: Number(it.tax_rate ?? product?.tax_rate ?? 0),
        qty: it.qty,
      };
    });
    setCart(items);
    setCustomerId(tx.customer_id || "");
    setDeliveryFee(tx.delivery_fee ? String(tx.delivery_fee) : "");

    // Diskon tersimpan di tx.discount adalah gabungan diskon persen pelanggan +
    // diskon manual. Diskon persen dihitung ulang dari subtotal saat ini supaya
    // sisanya (diskon manual) bisa dipulihkan ke kolom Diskon Manual.
    const recallCustomer = customers.find((c) => c.id === (tx.customer_id || ""));
    const recallSubtotal = items.reduce((s, i) => s + i.unit_price * i.qty, 0);
    const recallPercentDiscount = Math.round((recallSubtotal * (recallCustomer?.discount_percent || 0)) / 100);
    const recallManualDiscount = Math.max(0, Number(tx.discount || 0) - recallPercentDiscount);
    setManualDiscount(recallManualDiscount ? String(recallManualDiscount) : "");

    setPendingList((prev) => prev.filter((t) => t.id !== tx.id));
    setPendingOpen(false);

    // Hapus record pending dari database karena sudah ditarik kembali ke keranjang.
    // Dicek hasilnya supaya kalau RLS/izin menolak, kasir diberi tahu (kalau tidak,
    // transaksi ini akan "hidup lagi" di daftar tertahan setelah reload).
    supabase
      .from("transactions")
      .delete()
      .eq("id", tx.id)
      .select("id")
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          toast.error("Transaksi lama gagal dihapus dari server, mungkin muncul lagi di daftar tertahan setelah reload.");
        }
      });
  }

  // ---------- Batalkan transaksi tertahan (tombol X / tong sampah) ----------
  async function deletePendingTransaction(tx) {
    try {
      const { error } = await supabase.from("transaction_items").delete().eq("transaction_id", tx.id);
      if (error) throw error;
      const { data: txDeleted, error: txError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", tx.id)
        .select("id");
      if (txError) throw txError;
      // Supabase/Postgres tidak melempar error saat RLS memblokir DELETE,
      // hanya menghasilkan 0 baris. Cek eksplisit di sini supaya tidak
      // menampilkan "berhasil" padahal baris masih ada di database
      // (transaksi jadi terlihat muncul lagi setelah refresh).
      if (!txDeleted || txDeleted.length === 0) {
        throw new Error("Transaksi tidak terhapus (kemungkinan tidak diizinkan oleh server). Coba muat ulang halaman.");
      }
      setPendingList((prev) => prev.filter((t) => t.id !== tx.id));
      toast.success("Transaksi tertahan dibatalkan");
    } catch (err) {
      toast.error(err.message || "Gagal membatalkan transaksi tertahan");
    }
  }

  // ---------- Checkout (F12 submit) ----------
  async function handleCheckout({ method, paid, change }) {
    // Cegah menjual melebihi stok yang tersedia — jangan pernah izinkan checkout kalau begitu.
    const insufficient = [];
    for (const i of cart) {
      const product = products.find((p) => p.id === i.product_id);
      const qtyOut = i.qty * i.stock_factor;
      const branchStock = getBranchStock(product, sessionBranchId);
      if (product && qtyOut > branchStock.stock_qty) {
        insufficient.push(`${product.name} (stok ${formatNumber(branchStock.stock_qty, 2)}, diminta ${formatNumber(qtyOut, 2)})`);
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
          branch_id: sessionBranchId,
          customer_id: customerId || null,
          subtotal: totals.subtotal,
          discount: totals.discount,
          delivery_fee: totals.delivery,
          tax_amount: totals.tax,
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

      const items = cart.map((i) => {
        const lineTotal = i.unit_price * i.qty;
        const rate = Number(i.tax_rate || 0);
        const lineTax = rate > 0 ? Math.round(taxInclusive ? lineTotal - lineTotal / (1 + rate / 100) : (lineTotal * rate) / 100) : 0;
        return {
          transaction_id: tx.id,
          product_id: i.product_id,
          price_type: i.price_type,
          qty: i.qty,
          unit_price: i.unit_price,
          cost_price_snapshot: i.cost_price,
          tax_rate: rate,
          tax_amount: lineTax,
          subtotal: lineTotal,
        };
      });
      const { error: itemErr } = await supabase.from("transaction_items").insert(items);
      if (itemErr) throw itemErr;

      // kurangi stok cabang ini + catat pergerakan stok
      // PENTING: kalau salah satu update di sini gagal, jangan diamkan saja --
      // uang pelanggan sudah diterima & transaksi sudah tercatat, jadi tidak
      // dibatalkan, tapi kasir/admin WAJIB diberi tahu supaya stok yang gagal
      // ke-update bisa dibetulkan manual (sebelumnya di sini errornya tidak
      // pernah dicek sama sekali, jadi kalau gagal, stok diam-diam salah tanpa
      // ada yang sadar).
      let anyLowStock = false;
      const stockErrors = [];
      for (const i of cart) {
        const product = products.find((p) => p.id === i.product_id);
        const qtyOut = i.qty * i.stock_factor;
        const branchStock = getBranchStock(product, sessionBranchId);
        const newStock = Math.max(0, branchStock.stock_qty - qtyOut);
        const { error: stockErr } = await supabase
          .from("product_branch_stock")
          .upsert({ product_id: i.product_id, branch_id: sessionBranchId, stock_qty: newStock, min_stock: branchStock.min_stock }, { onConflict: "product_id,branch_id" });
        if (stockErr) {
          stockErrors.push(product?.name || i.product_id);
          continue; // jangan catat pergerakan stok kalau stoknya sendiri gagal diupdate
        }
        const { error: moveErr } = await supabase.from("stock_movements").insert({
          product_id: i.product_id,
          branch_id: sessionBranchId,
          movement_type: "penjualan",
          qty: -qtyOut,
          note: `Transaksi ${tx.id}`,
          created_by: profile.id,
        });
        if (moveErr) console.error("Gagal mencatat pergerakan stok:", moveErr);
        if (product) {
          const row = (product.product_branch_stock || []).find((s) => s.branch_id === sessionBranchId);
          if (row) row.stock_qty = newStock;
          else product.product_branch_stock = [...(product.product_branch_stock || []), { branch_id: sessionBranchId, stock_qty: newStock, min_stock: branchStock.min_stock }];
          if (branchStock.min_stock > 0 && newStock <= branchStock.min_stock) anyLowStock = true;
        }
      }
      if (stockErrors.length > 0) {
        toast.error(
          `Transaksi tersimpan, TAPI stok barang berikut GAGAL diperbarui otomatis: ${stockErrors.join(", ")}. Cek & sesuaikan manual di halaman Produk & Harga.`,
          { duration: 8000 }
        );
      }

      // Notifikasi stok menipis dikirim di background (tidak menunggu/menghambat
      // struk tampil ke kasir); server yang menentukan barang mana saja yang
      // benar-benar perlu dikirim & anti-spam-nya, ini cuma pemicu.
      if (anyLowStock) {
        fetch("/api/notify/low-stock", { method: "POST" }).catch(() => {});
      }

      if (method === "kasbon" && customerId) {
        const { error: kasbonErr } = await supabase.from("kasbon").insert({
          customer_id: customerId,
          transaction_id: tx.id,
          amount: totals.total,
        });
        if (kasbonErr) {
          toast.error(
            `Transaksi tersimpan, TAPI catatan kasbon pelanggan GAGAL dibuat: ${kasbonErr.message}. Cek & tambahkan manual di halaman Kasbon Pelanggan.`,
            { duration: 8000 }
          );
        }
      }

      await logActivity(supabase, {
        userId: profile.id,
        action: "checkout",
        entity: "transactions",
        entityId: tx.id,
        details: { total: totals.total, method },
      });

      const receiptData = {
        store: settings,
        tx,
        items: cart.map((i) => ({ name: i.name, price_type: i.price_type, qty: i.qty, unit_price: i.unit_price })),
        cashierName: profile.full_name,
        customerName: customer?.name || null,
        customerPhone: customer?.phone || null,
      };
      setLastReceipt(receiptData);
      setReceiptModalOpen(true);
      // Struk HANYA ditampilkan di layar dulu (ReceiptModal). Dialog cetak
      // browser baru muncul kalau kasir menekan tombol "Cetak Struk" di
      // modal itu -- tidak langsung terbuka otomatis setelah bayar.

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

  if (needsBranchPicker) {
    return (
      <div className="flex items-center justify-center app-shell-height bg-background p-4">
        <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-6 text-center">
          <Building2 className="mx-auto mb-3 text-primary" size={32} />
          <h2 className="text-base font-semibold mb-1">Pilih Cabang</h2>
          <p className="text-sm text-ink-muted mb-4">
            Akun ini belum ditugaskan ke satu cabang tertentu. Pilih cabang untuk sesi kasir ini —
            stok & transaksi akan tercatat milik cabang yang dipilih.
          </p>
          <div className="space-y-2">
            {branches.map((b) => (
              <button
                key={b.id}
                onClick={() => setSessionBranchId(b.id)}
                className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:border-primary hover:bg-primary-soft"
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!shift) {
    return <OpeningCashModal amount={profile.default_opening_cash} onConfirm={handleOpenShift} loading={openingLoading} />;
  }

  return (
    <div className="flex flex-1 app-shell-height overflow-hidden bg-background">
      {/* Class "app-shell-height" (lihat globals.css) = tinggi 100dvh dengan fallback 100vh,
          supaya tinggi kontainer pas dengan layar yang benar-benar kelihatan di HP
          (dan tetap bekerja di browser/webview lama), sehingga baris atas (hamburger,
          status scanner) dan kolom pencarian tetap diam -- yang scroll cuma keranjang. */}
      {/* SIDEBAR: hanya shortkey, diatur admin -- disembunyikan di HP (jadi menu geser), mengecil di tablet */}
      {!isMobile && (
        <aside className={`${isTablet ? "w-48" : "w-56"} shrink-0 border-r border-border bg-surface flex flex-col`}>
          <div className="p-4 border-b border-border">
            <p className="text-sm font-semibold truncate">{settings?.store_name || "Toko"}</p>
            <p className="text-xs text-ink-muted truncate">{profile.full_name}</p>
            {(branches || []).length > 1 && activeBranchName && (
              <p className="text-[11px] text-primary truncate mt-0.5">Cabang: {activeBranchName}</p>
            )}
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
            {/* Tablet biasanya tidak punya scanner USB/Bluetooth seperti di kasir meja,
                tapi ada kamera -- sediakan tombol scan kamera juga di sini (desktop
                dibiarkan seperti semula, biasanya sudah pakai scanner fisik). */}
            {isTablet && (
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background"
              >
                <ScanLine size={14} /> Scan via Kamera
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto overscroll-contain p-3">
            {/* Shortcut Aksi Sistem: F2/F4/F7/F8/F12/F6, bisa diatur admin */}
            <div className="flex items-center justify-between px-1 mb-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Shortcut Aksi</p>
              <span className="text-[10px] text-ink-muted italic">diatur admin</span>
            </div>
            <div className="space-y-1">
              {SYSTEM_ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => triggerMobileShortcut(a.key)}
                    className="w-full flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm bg-background hover:border-primary hover:bg-primary-soft active:bg-primary-soft transition text-left"
                  >
                    <Icon size={15} className="text-ink-muted shrink-0" />
                    <span className="flex-1 truncate">{a.label}</span>
                    <span className="kbd shrink-0">{hotkeys[a.key]}</span>
                  </button>
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
              onClick={() => lastReceipt && setReceiptModalOpen(true)}
              disabled={!lastReceipt}
              className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Lihat / Cetak Ulang Struk Terakhir
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
      )}

      {/* MENU GESER (khusus HP): berisi semua yang ada di sidebar desktop, dibuka lewat tombol hamburger */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] h-full bg-surface border-r border-border flex flex-col">
            <div className="p-4 border-b border-border flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold truncate">{settings?.store_name || "Toko"}</p>
                <p className="text-xs text-ink-muted truncate">{profile.full_name}</p>
                {impersonating && <p className="text-[10px] text-primary mt-0.5">Dibuka oleh admin</p>}
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1.5 rounded-lg hover:bg-background">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto overscroll-contain p-3 space-y-4">
              <div>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Shortcut Aksi (tap untuk pakai)</p>
                  <span className="text-[10px] text-ink-muted italic">diatur admin</span>
                </div>
                <div className="space-y-1">
                  {SYSTEM_ACTIONS.map((a) => {
                    const Icon = a.icon;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => triggerMobileShortcut(a.key)}
                        className="w-full flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm bg-background hover:border-primary hover:bg-primary-soft active:bg-primary-soft transition text-left"
                      >
                        <Icon size={15} className="text-ink-muted shrink-0" />
                        <span className="flex-1 truncate">{a.label}</span>
                        <span className="kbd shrink-0">{hotkeys[a.key]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-border">
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
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setCameraOpen(true);
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background"
                >
                  Scan via Kamera HP
                </button>
                <button
                  onClick={() => lastReceipt && setReceiptModalOpen(true)}
                  disabled={!lastReceipt}
                  className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lihat / Cetak Ulang Struk Terakhir
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
            </div>
          </aside>
        </div>
      )}

      {/* AREA KERANJANG */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Baris atas khusus HP: menu (hamburger) + konek scanner, DI ATAS kolom pencarian */}
        {isMobile && (
          <div className="shrink-0 sticky top-0 z-30 p-2.5 border-b border-border bg-surface flex items-center gap-2">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 rounded-lg border border-border hover:bg-background shrink-0">
              <Menu size={18} />
            </button>
            <ScannerStatusWidget />
            <span className="text-xs text-ink-muted truncate ml-auto">{profile.full_name}</span>
          </div>
        )}
        <div className="shrink-0 p-4 border-b border-border bg-surface flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative">
          <div className="flex-1 flex items-center gap-2 relative">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchResults[0]) handlePickProduct(searchResults[0]);
                if (e.key === "Escape") setSearch("");
              }}
              placeholder={`Cari nama barang... (${hotkeys.search})`}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            {isMobile && (
              <button
                onClick={() => setCameraOpen(true)}
                title="Pindai barcode dengan kamera"
                className="shrink-0 rounded-lg border border-border bg-background px-3 py-2.5 hover:bg-surface"
              >
                <ScanLine size={18} />
              </button>
            )}

            {/* Tablet & desktop: daftar hasil pencarian tampil menurun (dropdown list)
                tepat di bawah kolom pencarian, supaya nama & harga barang kebaca penuh
                tanpa perlu geser ke samping seperti versi chip sebelumnya. */}
            {!isMobile && searchResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-surface border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handlePickProduct(p)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-sm border-b border-border last:border-b-0 hover:bg-primary-soft text-left"
                  >
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-ink-muted shrink-0">{formatRupiah(p.sell_price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none sm:max-w-[180px]"
          >
            <option value="">Pelanggan Umum</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {isMobile && searchResults.length > 0 && (
          // Versi HP: daftar hasil pencarian ditampilkan menurun (list ke bawah) di
          // bawah seluruh baris pencarian, supaya nama & harga barang kebaca penuh.
          <div className="border-b border-border bg-surface max-h-64 overflow-y-auto">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePickProduct(p)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-sm border-b border-border last:border-b-0 hover:bg-primary-soft active:bg-primary-soft text-left"
              >
                <span className="font-medium truncate">{p.name}</span>
                <span className="text-ink-muted shrink-0">{formatRupiah(p.sell_price)}</span>
              </button>
            ))}
          </div>
        )}

        {isMobile ? (
          <div className="flex-1 overflow-auto overscroll-contain p-3 space-y-2">
            {cart.length === 0 ? (
              <p className="text-center text-ink-muted py-16 text-sm">
                Keranjang kosong. Cari barang atau gunakan scan barcode.
              </p>
            ) : (
              cart.map((item, index) => (
                <div
                  key={item.key}
                  onClick={() => setSelectedIndex(index)}
                  className={`rounded-xl border p-3 ${
                    selectedIndex === index ? "border-primary bg-primary-soft" : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium flex-1 truncate">{item.name}</p>
                    <p className="text-sm font-semibold">{formatRupiah(item.unit_price * item.qty)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={item.price_type}
                      onChange={(e) => changeCartItemVariant(index, e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary/40 min-w-0 max-w-[120px]"
                    >
                      {getPriceVariants(products.find((p) => p.id === item.product_id) || {}).map((v) => (
                        <option key={v.price_type} value={v.price_type}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-ink-muted flex-1 min-w-0 truncate">{formatNumber(item.qty, 2)} x {formatRupiah(item.unit_price)}</span>
                    {/* Di desktop qty/hapus dipakai lewat tombol F4/Delete di keyboard; di HP
                        tidak ada keyboard, jadi disediakan tombol sentuh. Dibuat ikon saja
                        (bukan tombol teks penuh) supaya tidak makan tempat di layar sempit. */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIndex(index);
                        setQtyModalItem(item);
                      }}
                      title="Ubah Qty"
                      aria-label="Ubah Qty"
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-border bg-background hover:bg-surface"
                    >
                      <Hash size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Hapus "${item.name}" dari keranjang?`)) removeItem(index);
                      }}
                      title="Hapus"
                      aria-label="Hapus"
                      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-danger/30 bg-danger-soft text-danger hover:bg-danger/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-auto overscroll-contain">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface border-b border-border text-xs text-ink-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Barang</th>
                  <th className="text-left px-4 py-2 font-medium">Jenis</th>
                  <th className="text-right px-4 py-2 font-medium">Harga</th>
                  <th className="text-right px-4 py-2 font-medium">Qty</th>
                  <th className="text-right px-4 py-2 font-medium">Subtotal</th>
                  {/* Tablet layar sentuh umumnya tidak punya keyboard fisik untuk F4/Delete,
                      jadi disediakan kolom tombol sentuh. Desktop (asumsi ada keyboard/mouse)
                      tetap seperti semula supaya tidak berubah. */}
                  {isTablet && <th className="text-right px-4 py-2 font-medium">Aksi</th>}
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
                    {isTablet && (
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIndex(index);
                              setQtyModalItem(item);
                            }}
                            title="Ubah Qty"
                            aria-label="Ubah Qty"
                            className="w-7 h-7 flex items-center justify-center rounded-md border border-border bg-background hover:bg-surface"
                          >
                            <Hash size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Hapus "${item.name}" dari keranjang?`)) removeItem(index);
                            }}
                            title="Hapus"
                            aria-label="Hapus"
                            className="w-7 h-7 flex items-center justify-center rounded-md border border-danger/30 bg-danger-soft text-danger hover:bg-danger/10"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {cart.length === 0 && (
                  <tr>
                    <td colSpan={isTablet ? 6 : 5} className="text-center text-ink-muted py-16 text-sm">
                      Keranjang kosong. Cari barang atau gunakan shortcut / scan barcode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Ringkasan & shortkey */}
        <div className="border-t border-border bg-surface p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <label className="text-sm text-ink-muted whitespace-nowrap">Diskon</label>
            <input
              value={manualDiscount}
              onChange={(e) => setManualDiscount(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              inputMode="numeric"
              placeholder="0"
              className="w-24 sm:w-28 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
            <label className="text-sm text-ink-muted whitespace-nowrap">Antar</label>
            <input
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              inputMode="numeric"
              placeholder="0"
              className="w-24 sm:w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="hidden sm:block flex-1" />
            <div className="text-right ml-auto sm:ml-0">
              {totals.discount > 0 && <p className="text-xs text-danger">Diskon -{formatRupiah(totals.discount)}</p>}
              {totals.tax > 0 && (
                <p className="text-xs text-ink-muted">
                  {settings?.tax_label || "PPN"} {taxInclusive ? "(termasuk harga)" : ""} {taxInclusive ? "" : `+${formatRupiah(totals.tax)}`}
                </p>
              )}
              <p className="text-xs text-ink-muted">Total</p>
              <p className="text-lg sm:text-xl font-semibold">{formatRupiah(totals.total)}</p>
            </div>
            <button
              onClick={() => cart.length > 0 && setPaymentOpen(true)}
              disabled={cart.length === 0}
              className="w-full sm:w-auto bg-primary text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-primary-hover disabled:opacity-40 order-last"
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
          onDelete={deletePendingTransaction}
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

      {receiptModalOpen && lastReceipt && (
        <ReceiptModal
          data={lastReceipt}
          onPrint={() => printReceipt(lastReceipt)}
          onClose={() => setReceiptModalOpen(false)}
        />
      )}
    </div>
  );
}
