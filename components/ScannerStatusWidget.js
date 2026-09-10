"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ScanLine, X } from "lucide-react";
import { useScanner } from "./ScannerProvider";

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec} detik lalu`;
  return `${Math.floor(sec / 60)} menit lalu`;
}

export default function ScannerStatusWidget() {
  const { physicalActive, phoneConnected, phoneSessionId, phoneError, lastScan, startPairing, stopPairing } = useScanner();
  const [modalOpen, setModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!modalOpen) return;
    const id = phoneSessionId || startPairing();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    QRCode.toDataURL(`${origin}/scan-remote?s=${id}`, { margin: 1, width: 260 }).then(setQrDataUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen]);

  // Refresh tampilan "x detik lalu" setiap detik selagi modal terbuka
  useEffect(() => {
    if (!modalOpen) return;
    const t = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [modalOpen]);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs hover:bg-background"
        title="Sambungkan scanner"
      >
        <ScanLine size={14} />
        <span className="hidden sm:inline">Scanner</span>
        <span className={`h-1.5 w-1.5 rounded-full ${physicalActive || phoneConnected ? "bg-primary" : "bg-danger"}`} />
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Sambungkan Scanner</h2>
              <button onClick={() => setModalOpen(false)} className="text-ink-muted hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-sm border border-border rounded-lg px-3 py-2">
                <span>Scanner Fisik (USB/Bluetooth)</span>
                <span className={`flex items-center gap-1.5 text-xs ${physicalActive ? "text-primary" : "text-ink-muted"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${physicalActive ? "bg-primary" : "bg-danger"}`} />
                  {physicalActive ? "Siap" : "Belum ada aktivitas"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border border-border rounded-lg px-3 py-2">
                <span>Scanner HP (via QR)</span>
                <span className={`flex items-center gap-1.5 text-xs ${phoneConnected ? "text-primary" : "text-ink-muted"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${phoneConnected ? "bg-primary" : "bg-danger"}`} />
                  {phoneConnected ? "Terhubung" : "Menunggu HP"}
                </span>
              </div>
            </div>

            {phoneError && (
              <p className="text-xs text-danger bg-danger-soft rounded-lg px-3 py-2 mb-3">{phoneError}</p>
            )}

            {/* Diagnosa: bukti nyata apakah data dari HP benar-benar sampai ke layar ini */}
            <div className="rounded-lg bg-background border border-border px-3 py-2 mb-4">
              <p className="text-[11px] text-ink-muted mb-0.5">Scan Terakhir Diterima di Layar Ini</p>
              {lastScan ? (
                <p className="text-sm font-mono">
                  {lastScan.code} <span className="text-ink-muted font-sans">({lastScan.source === "phone" ? "dari HP" : "scanner fisik"} · {timeAgo(lastScan.at)})</span>
                </p>
              ) : (
                <p className="text-sm text-ink-muted italic">Belum ada scan yang diterima</p>
              )}
            </div>

            <p className="text-xs text-ink-muted mb-3 text-center">
              Buka kamera HP (atau browser HP), pindai kode QR ini untuk menjadikan HP sebagai alat scan.
              Setelah tersambung, cukup arahkan HP ke barcode barang — hasilnya langsung terpakai
              di layar ini, di halaman mana pun sedang dibuka. <strong>Jangan matikan layar HP</strong>
              selama dipakai sebagai scanner.
            </p>

            <div className="flex justify-center bg-white rounded-xl p-4 mb-3">
              {qrDataUrl ? <img src={qrDataUrl} alt="QR sambungkan scanner HP" width={220} height={220} /> : <p className="text-xs text-ink-muted py-16">Membuat kode QR...</p>}
            </div>

            <p className="text-xs text-ink-muted mb-1">Atau buka tautan ini langsung di HP:</p>
            <p className="text-xs font-mono bg-background rounded-lg px-3 py-2 break-all mb-4">
              {typeof window !== "undefined" ? `${window.location.origin}/scan-remote?s=${phoneSessionId}` : ""}
            </p>

            <button
              onClick={() => {
                stopPairing();
                setModalOpen(false);
              }}
              className="w-full border border-border rounded-lg py-2 text-sm font-medium hover:bg-background"
            >
              Putuskan & Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
}
