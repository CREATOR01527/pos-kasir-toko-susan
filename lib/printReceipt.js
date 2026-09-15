// Mencetak struk pembayaran ke printer thermal (58mm/80mm) lewat iframe
// tersembunyi, sama seperti teknik cetak label barcode (lib/printBarcodeLabel.js)
// supaya tidak ikut mencetak seluruh tampilan aplikasi.

import { formatRupiah, formatNumber, formatDateTime, txCode } from "@/lib/format";

const PAPER_WIDTH_MM = { "58mm": 58, "80mm": 80 };

const PRICE_TYPE_LABELS = {
  grosir: "Grosir",
  half_grosir: "1/2 Grosir",
  kg: "Per Kg",
  half_kg: "Per 1/2 Kg",
  ons: "Per Ons",
  out_of_town: "Antar Luar Kota",
};

// data: { store, tx, items, cashierName, customerName }
// store: baris store_settings (nama, alamat, telp, pengaturan struk, catatan kaki)
// tx: { id, created_at, payment_method, subtotal, discount, delivery_fee, total, paid_amount, change_amount }
// items: [{ name, price_type, qty, unit_price }]
export function printReceipt({ store, tx, items, cashierName, customerName }) {
  const width = PAPER_WIDTH_MM[store?.receipt_paper_size] || 58;

  const PAYMENT_LABELS = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS", kasbon: "Kasbon" };

  const itemRows = (items || [])
    .map((it) => {
      const tierLabel = PRICE_TYPE_LABELS[it.price_type];
      return `
        <div class="item">
          <div class="item-name">${escapeHtml(it.name)}${tierLabel ? ` <span class="tier">(${escapeHtml(tierLabel)})</span>` : ""}</div>
          <div class="item-line">
            <span>${formatNumber(it.qty, 2)} x ${formatRupiah(it.unit_price)}</span>
            <span>${formatRupiah(it.unit_price * it.qty)}</span>
          </div>
        </div>
      `;
    })
    .join("");

  const rows = [];
  rows.push(row("Subtotal", formatRupiah(tx.subtotal)));
  if (Number(tx.discount) > 0) rows.push(row("Diskon", `-${formatRupiah(tx.discount)}`));
  if (Number(tx.delivery_fee) > 0) rows.push(row("Biaya Antar", formatRupiah(tx.delivery_fee)));
  if (Number(tx.tax_amount) > 0 && !store?.tax_price_inclusive) {
    rows.push(row(store?.tax_label || "PPN", `+${formatRupiah(tx.tax_amount)}`));
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: ${width}mm auto; margin: 0; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 3mm;
            width: ${width}mm;
            font-family: "Courier New", monospace;
            font-size: ${width >= 80 ? "11px" : "10px"};
            color: #000;
          }
          .center { text-align: center; }
          .store-name { font-size: ${width >= 80 ? "14px" : "13px"}; font-weight: bold; }
          .muted { font-size: 9px; }
          hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
          .item { margin-bottom: 2px; }
          .item-name { }
          .item-line, .row { display: flex; justify-content: space-between; gap: 6px; }
          .row.total { font-weight: bold; font-size: ${width >= 80 ? "13px" : "12px"}; }
          .tier { font-size: 9px; }
          .footer { margin-top: 6px; white-space: pre-line; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="store-name">${escapeHtml(store?.store_name || "Toko")}</div>
          ${store?.receipt_show_address !== false && store?.store_address ? `<div class="muted">${escapeHtml(store.store_address)}</div>` : ""}
          ${store?.receipt_show_phone !== false && store?.store_phone ? `<div class="muted">${escapeHtml(store.store_phone)}</div>` : ""}
        </div>
        <hr />
        <div class="muted">
          <div class="store-name" style="font-size: ${width >= 80 ? "12px" : "11px"};">${txCode(tx.id)}</div>
          <div>${formatDateTime(tx.created_at || new Date())}</div>
          ${store?.receipt_show_cashier !== false && cashierName ? `<div>Kasir: ${escapeHtml(cashierName)}</div>` : ""}
          ${store?.receipt_show_customer !== false && customerName ? `<div>Pelanggan: ${escapeHtml(customerName)}</div>` : ""}
        </div>
        <hr />
        ${itemRows}
        <hr />
        ${rows.join("")}
        <div class="row total"><span>Total</span><span>${formatRupiah(tx.total)}</span></div>
        <hr />
        <div class="row"><span>${PAYMENT_LABELS[tx.payment_method] || tx.payment_method}</span><span></span></div>
        ${tx.payment_method !== "kasbon" ? `
          <div class="row"><span>Dibayar</span><span>${formatRupiah(tx.paid_amount)}</span></div>
          <div class="row"><span>Kembali</span><span>${formatRupiah(tx.change_amount)}</span></div>
        ` : ""}
        ${store?.receipt_footer ? `<div class="center footer">${escapeHtml(store.receipt_footer)}</div>` : ""}
      </body>
    </html>
  `;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 250);
}

function row(label, value) {
  return `<div class="row"><span>${escapeHtml(label)}</span><span>${value}</span></div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
