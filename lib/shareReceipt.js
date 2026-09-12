// Membangun teks struk polos untuk dibagikan lewat WhatsApp (link wa.me),
// dan tidak butuh akun WhatsApp Business API / pihak ketiga berbayar apa pun.
// Kalau pelanggan punya nomor HP tersimpan, link langsung menuju nomor itu;
// kalau tidak, link dibuka tanpa nomor tujuan supaya kasir tinggal pilih
// kontak dari daftar WhatsApp di HP-nya sendiri.

import { formatRupiah, formatNumber, formatDateTime } from "@/lib/format";

const PRICE_TYPE_LABELS = {
  grosir: "Grosir",
  half_grosir: "1/2 Grosir",
  kg: "Per Kg",
  half_kg: "Per 1/2 Kg",
  ons: "Per Ons",
  out_of_town: "Antar Luar Kota",
};

const PAYMENT_LABELS = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS", kasbon: "Kasbon" };

export function buildReceiptText({ store, tx, items, cashierName, customerName }) {
  const lines = [];
  lines.push(`*${store?.store_name || "Toko"}*`);
  if (store?.store_address) lines.push(store.store_address);
  if (store?.store_phone) lines.push(store.store_phone);
  lines.push("—".repeat(20));
  lines.push(formatDateTime(tx.created_at || new Date()));
  if (cashierName) lines.push(`Kasir: ${cashierName}`);
  if (customerName) lines.push(`Pelanggan: ${customerName}`);
  lines.push("—".repeat(20));

  for (const it of items || []) {
    const tier = PRICE_TYPE_LABELS[it.price_type];
    lines.push(`${it.name}${tier ? ` (${tier})` : ""}`);
    lines.push(`${formatNumber(it.qty, 2)} x ${formatRupiah(it.unit_price)} = ${formatRupiah(it.unit_price * it.qty)}`);
  }
  lines.push("—".repeat(20));

  lines.push(`Subtotal: ${formatRupiah(tx.subtotal)}`);
  if (Number(tx.discount) > 0) lines.push(`Diskon: -${formatRupiah(tx.discount)}`);
  if (Number(tx.delivery_fee) > 0) lines.push(`Biaya Antar: ${formatRupiah(tx.delivery_fee)}`);
  if (Number(tx.tax_amount) > 0 && !store?.tax_price_inclusive) {
    lines.push(`${store?.tax_label || "PPN"}: +${formatRupiah(tx.tax_amount)}`);
  }
  lines.push(`*Total: ${formatRupiah(tx.total)}*`);
  lines.push(`Bayar (${PAYMENT_LABELS[tx.payment_method] || tx.payment_method}): ${formatRupiah(tx.paid_amount)}`);
  if (tx.payment_method !== "kasbon") lines.push(`Kembali: ${formatRupiah(tx.change_amount)}`);

  if (store?.receipt_footer) {
    lines.push("");
    lines.push(store.receipt_footer);
  }

  return lines.join("\n");
}

// Menormalkan nomor HP Indonesia (08xx, +62xx, 62xx, spasi/strip) ke format
// 62xxxxxxxxxx yang dipakai wa.me. Mengembalikan null kalau tidak valid,
// supaya pemanggil bisa jatuh ke link tanpa nomor tujuan.
export function normalizeIndonesianPhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/[^0-9]/g, "");
  if (!digits) return null;
  if (digits.startsWith("620")) digits = "62" + digits.slice(3);
  if (digits.startsWith("0")) digits = "62" + digits.slice(1);
  if (!digits.startsWith("62")) digits = "62" + digits;
  return digits.length >= 10 ? digits : null;
}

export function shareReceiptToWhatsApp(receiptData) {
  const text = buildReceiptText(receiptData);
  const phone = normalizeIndonesianPhone(receiptData.customerPhone);
  const url = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
