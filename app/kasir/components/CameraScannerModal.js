"use client";

import { useEffect, useRef } from "react";

// Menggunakan library html5-qrcode untuk memakai kamera HP/laptop sebagai
// scanner barcode. Dimuat secara dinamis agar tidak membebani bundle awal.
export default function CameraScannerModal({ onDetected, onClose }) {
  const containerId = "camera-scanner-region";
  const scannerRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    let html5Qrcode;

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (stopped) return;
      html5Qrcode = new Html5Qrcode(containerId);
      scannerRef.current = html5Qrcode;
      html5Qrcode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            onDetected(decodedText);
          },
          () => {}
        )
        .catch(() => {
          onClose();
        });
    });

    return () => {
      stopped = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-4">
        <h2 className="text-sm font-semibold mb-3 text-center">Pindai Barcode dengan Kamera</h2>
        <div id={containerId} className="rounded-lg overflow-hidden bg-black" />
        <button onClick={onClose} className="mt-4 w-full border border-border rounded-lg py-2 text-sm font-medium hover:bg-background">
          Tutup Kamera
        </button>
      </div>
    </div>
  );
}
