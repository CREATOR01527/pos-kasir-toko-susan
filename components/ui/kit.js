"use client";

export function Card({ title, action, children, className = "" }) {
  return (
    <div className={`bg-surface border border-border rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "default" }) {
  const toneClass =
    tone === "danger" ? "text-danger" : tone === "primary" ? "text-primary" : "text-ink";
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <p className="text-xs text-ink-muted mb-1.5">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    outline: "border border-border hover:bg-background",
    danger: "text-danger hover:bg-danger-soft",
    ghost: "text-ink-muted hover:bg-background hover:text-ink",
  };
  return (
    <button
      className={`rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

// alignRow=true: dipakai saat Input ini adalah salah satu dari beberapa kolom sejajar
// dalam satu baris grid (mis. grid-cols-3). Memakai CSS subgrid supaya label, kotak input,
// dan hint SELALU sejajar rapi lintas kolom, walau panjang teks labelnya beda-beda
// (wrap 1/2/3 baris) atau cuma sebagian kolom yang punya hint. Baris grid pembungkusnya
// tidak perlu class tambahan apa pun — cukup pastikan jumlah item persis sama dengan
// jumlah kolom grid (satu baris visual saja, jangan sampai wrap ke baris ke-2).
const rowFieldClass = (alignRow) =>
  alignRow ? "grid row-span-3 [grid-template-rows:subgrid]" : "flex flex-col";

export function Input({ label, hint, className = "", alignRow = false, ...props }) {
  return (
    <div className={`${rowFieldClass(alignRow)} ${className}`}>
      {label ? (
        <label className={`text-sm font-medium mb-1.5 leading-snug ${alignRow ? "self-end" : "flex items-end min-h-[2.5rem]"}`}>{label}</label>
      ) : alignRow ? (
        <span />
      ) : null}
      <input
        {...props}
        onWheel={(e) => e.currentTarget.blur()}
        className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary ${alignRow ? "self-start" : ""}`}
      />
      {hint ? <p className={`text-xs text-ink-muted mt-1 ${alignRow ? "self-start" : ""}`}>{hint}</p> : alignRow ? <span /> : null}
    </div>
  );
}

export function Textarea({ label, hint, className = "", alignRow = false, ...props }) {
  return (
    <div className={`${rowFieldClass(alignRow)} ${className}`}>
      {label ? (
        <label className={`text-sm font-medium mb-1.5 leading-snug ${alignRow ? "self-end" : "flex items-end min-h-[2.5rem]"}`}>{label}</label>
      ) : alignRow ? (
        <span />
      ) : null}
      <textarea
        {...props}
        className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary ${alignRow ? "self-start" : ""}`}
      />
      {hint ? <p className={`text-xs text-ink-muted mt-1 ${alignRow ? "self-start" : ""}`}>{hint}</p> : alignRow ? <span /> : null}
    </div>
  );
}

export function Select({ label, hint, children, className = "", alignRow = false, ...props }) {
  return (
    <div className={`${rowFieldClass(alignRow)} ${className}`}>
      {label ? (
        <label className={`text-sm font-medium mb-1.5 leading-snug ${alignRow ? "self-end" : "flex items-end min-h-[2.5rem]"}`}>{label}</label>
      ) : alignRow ? (
        <span />
      ) : null}
      <select
        {...props}
        className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary ${alignRow ? "self-start" : ""}`}
      >
        {children}
      </select>
      {hint ? <p className={`text-xs text-ink-muted mt-1 ${alignRow ? "self-start" : ""}`}>{hint}</p> : alignRow ? <span /> : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-primary" : "bg-border"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-surface border border-border rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} p-6 max-h-[88vh] overflow-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ text }) {
  return <p className="text-center text-sm text-ink-muted py-12">{text}</p>;
}

export function Badge({ children, tone = "default" }) {
  const toneClass =
    tone === "danger"
      ? "bg-danger-soft text-danger"
      : tone === "warning"
      ? "bg-warning-soft text-warning"
      : tone === "primary"
      ? "bg-primary-soft text-primary"
      : "bg-background text-ink-muted";
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${toneClass}`}>{children}</span>;
}
