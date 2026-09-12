"use client";

import { formatRupiah, formatNumber, formatDateTime } from "@/lib/format";
import { shareReceiptToWhatsApp } from "@/lib/shareReceipt";

const PRICE_TYPE_LABELS = {
  grosir: "Grosir",
  half_grosir: "1/2 Grosir",
  kg: "Per Kg",
  half_kg: "Per 1/2 Kg",
  ons: "Per Ons",
  out_of_town: "Antar Luar Kota",
};

const PAYMENT_LABELS = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS", kasbon: "Kasbon" };

// Pratinjau struk di layar (bukan cuma cetak langsung ke printer) supaya kasir
// selalu bisa MELIHAT struknya di aplikasi, terlepas dari ada/tidaknya printer
// fisik yang terhubung. Tombol "Cetak Struk" tetap memanggil lib/printReceipt.js
// seperti biasa untuk cetak ke printer thermal.
export default function ReceiptModal({ data, onPrint, onClose }) {
  if (!data) return null;
  const { store, tx, items, cashierName, customerName } = data;

  const rows = [];
  rows.push({ label: "Subtotal", value: formatRupiah(tx.subtotal) });
  if (Number(tx.discount) > 0) rows.push({ label: "Diskon", value: `-${formatRupiah(tx.discount)}` });
  if (Number(tx.delivery_fee) > 0) rows.push({ label: "Biaya Antar", value: formatRupiah(tx.delivery_fee) });
  if (Number(tx.tax_amount) > 0 && !store?.tax_price_inclusive) {
    rows.push({ label: store?.tax_label || "PPN", value: `+${formatRupiah(tx.tax_amount)}` });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">Struk Transaksi</h2>
          <button onClick={onClose} className="text-ink-muted text-lg leading-none">&times;</button>
        </div>

        <div className="overflow-auto px-5 py-4 font-mono text-[13px] leading-snug">
          <div className="text-center">
            <p className="font-bold text-sm">{store?.store_name || "Toko"}</p>
            {store?.receipt_show_address !== false && store?.store_address && <p className="text-xs text-ink-muted">{store.store_address}</p>}
            {store?.receipt_show_phone !== false && store?.store_phone && <p className="text-xs text-ink-muted">{store.store_phone}</p>}
          </div>
          <hr className="border-dashed border-border my-2" />
          <div className="text-xs text-ink-muted">
            <p>{formatDateTime(tx.created_at || new Date())}</p>
            {store?.receipt_show_cashier !== false && cashierName && <p>Kasir: {cashierName}</p>}
            {store?.receipt_show_customer !== false && customerName && <p>Pelanggan: {customerName}</p>}
          </div>
          <hr className="border-dashed border-border my-2" />

          <div className="space-y-1.5">
            {(items || []).map((it, i) => {
              const tierLabel = PRICE_TYPE_LABELS[it.price_type];
              return (
                <div key={i}>
                  <p>{it.name}{tierLabel ? <span className="text-xs text-ink-muted"> ({tierLabel})</span> : ""}</p>
                  <div className="flex justify-between">
                    <span>{formatNumber(it.qty, 2)} x {formatRupiah(it.unit_price)}</span>
                    <span>{formatRupiah(it.unit_price * it.qty)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <hr className="border-dashed border-border my-2" />
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between">
              <span>{r.label}</span>
              <span>{r.value}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-sm mt-1">
            <span>Total</span>
            <span>{formatRupiah(tx.total)}</span>
          </div>
          <hr className="border-dashed border-border my-2" />
          <div className="flex justify-between">
            <span>{PAYMENT_LABELS[tx.payment_method] || tx.payment_method}</span>
            <span></span>
          </div>
          {tx.payment_method !== "kasbon" && (
            <>
              <div className="flex justify-between">
                <span>Dibayar</span>
                <span>{formatRupiah(tx.paid_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kembali</span>
                <span>{formatRupiah(tx.change_amount)}</span>
              </div>
            </>
          )}
          {store?.receipt_footer && (
            <p className="text-center whitespace-pre-line text-xs text-ink-muted mt-3">{store.receipt_footer}</p>
          )}
        </div>

        <div className="p-4 border-t border-border flex gap-2 flex-wrap">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-background">
            Tutup
          </button>
          <button
            onClick={() => shareReceiptToWhatsApp(data)}
            className="flex-1 rounded-lg border border-[#25D366] text-[#128C7E] px-3 py-2.5 text-sm font-medium hover:bg-[#25D366]/10"
          >
            Kirim WhatsApp
          </button>
          <button onClick={onPrint} className="flex-1 rounded-lg bg-primary text-white px-3 py-2.5 text-sm font-medium hover:bg-primary-hover">
            Cetak Struk
          </button>
        </div>
      </div>
    </div>
  );
}
