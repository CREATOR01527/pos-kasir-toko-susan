"use client";

import { useEffect, useRef, useState } from "react";

export default function QtyModal({ item, onConfirm, onClose }) {
  const [value, setValue] = useState(String(item?.qty ?? 1));
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  function submit() {
    const n = parseFloat(value.replace(",", "."));
    if (!isNaN(n) && n > 0) onConfirm(n);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold mb-1">Ubah Jumlah</h2>
        <p className="text-xs text-ink-muted mb-3 truncate">{item?.name}</p>
        <input
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          inputMode="decimal"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-lg text-center outline-none focus:ring-2 focus:ring-primary/40"
        />
        <p className="text-xs text-ink-muted mt-2 text-center">Ketik angka lalu tekan Enter</p>
      </div>
    </div>
  );
}
