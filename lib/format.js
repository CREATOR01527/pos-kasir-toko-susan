export function formatRupiah(value) {
  const n = Number(value || 0);
  return "Rp" + n.toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

// Kode transaksi pendek & mudah disebut/dicari, dipakai konsisten di nota
// fisik, nota digital, WhatsApp, dan halaman admin "Cek Transaksi" (supaya
// kode yang dilihat pelanggan di struk sama persis dengan yang dicari admin).
export function txCode(id) {
  if (!id) return "-";
  return `TRX-${String(id).slice(0, 8).toUpperCase()}`;
}

export function formatNumber(value, digits = 0) {
  const n = Number(value || 0);
  return n.toLocaleString("id-ID", { maximumFractionDigits: digits });
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
