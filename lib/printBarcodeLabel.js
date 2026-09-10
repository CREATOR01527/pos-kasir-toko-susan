// Mencetak label barcode secara terisolasi: hanya berisi nama toko (opsional),
// nama barang, harga, kode batang (barcode sungguhan, bukan tangkapan layar
// aplikasi), dan angkanya di bawah barcode — dicetak lewat iframe tersembunyi
// supaya tidak ikut mencetak seluruh tampilan aplikasi.

const LABEL_SIZE_MM = {
  kecil: { w: 40, h: 25 },
  sedang: { w: 50, h: 30 },
  besar: { w: 70, h: 40 },
};

export async function printBarcodeLabels({ storeName, productName, price, barcode, qty, labelSettings }) {
  const JsBarcode = (await import("jsbarcode")).default;
  const size = LABEL_SIZE_MM[labelSettings?.label_size] || LABEL_SIZE_MM.sedang;
  const count = Math.max(1, Number(qty) || 1);

  // Render barcode ke SVG string lewat elemen sementara (tidak ditampilkan di halaman utama)
  const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(tempSvg, barcode, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    height: size.h * 2.2,
    width: 2,
  });
  const barcodeSvgMarkup = tempSvg.outerHTML;

  const oneLabel = `
    <div class="label">
      ${labelSettings?.show_store_name && storeName ? `<div class="store">${escapeHtml(storeName)}</div>` : ""}
      <div class="name">${escapeHtml(productName)}</div>
      ${price ? `<div class="price">${escapeHtml(price)}</div>` : ""}
      ${labelSettings?.show_barcode !== false ? `<div class="barcode">${barcodeSvgMarkup}</div><div class="code">${escapeHtml(barcode)}</div>` : ""}
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { size: ${size.w}mm ${size.h}mm; margin: 0; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; }
          .label {
            width: ${size.w}mm;
            height: ${size.h}mm;
            padding: 1.5mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            page-break-after: always;
            overflow: hidden;
          }
          .store { font-size: 2.2mm; color: #444; margin-bottom: 0.3mm; }
          .name { font-size: 2.6mm; font-weight: bold; line-height: 1.1; margin-bottom: 0.3mm; }
          .price { font-size: 2.8mm; font-weight: bold; margin-bottom: 0.4mm; }
          .barcode { width: 100%; }
          .barcode svg { width: 100%; height: auto; display: block; }
          .code { font-size: 2mm; letter-spacing: 0.5px; margin-top: 0.2mm; }
        </style>
      </head>
      <body>
        ${oneLabel.repeat(count)}
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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
