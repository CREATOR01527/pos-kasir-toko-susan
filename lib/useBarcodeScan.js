"use client";

import { useEffect } from "react";
import { BARCODE_EVENT } from "@/components/ScannerProvider";

// Dipakai di halaman mana pun yang punya kolom cari/barcode produk.
// `handler(code)` dipanggil setiap kali ada hasil scan (fisik maupun HP),
// selama komponen yang memanggil hook ini sedang tampil di layar.
export function useBarcodeScan(handler) {
  useEffect(() => {
    function onScan(e) {
      const code = e.detail?.code;
      if (code) handler(code);
    }
    window.addEventListener(BARCODE_EVENT, onScan);
    return () => window.removeEventListener(BARCODE_EVENT, onScan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
}
