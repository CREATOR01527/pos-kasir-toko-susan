"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import CameraScannerModal from "@/app/kasir/components/CameraScannerModal";

// Tombol kecil untuk memindai barcode pakai kamera HP, ditaruh di sebelah
// kolom pencarian/kolom barcode. Dipakai di halaman Kasir & halaman-halaman
// admin (cari produk, cek produk, tambah produk) -- render komponen ini
// hanya kalau `useViewport().isMobile` true di komponen pemanggilnya.
export default function CameraScanButton({ onDetected, title = "Pindai barcode dengan kamera" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        title={title}
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-border bg-background px-3 py-2.5 text-sm hover:bg-surface flex items-center justify-center"
      >
        <ScanLine size={18} />
      </button>
      {open && (
        <CameraScannerModal
          onDetected={(code) => {
            setOpen(false);
            onDetected(code);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
