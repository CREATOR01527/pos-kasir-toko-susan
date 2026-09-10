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

export function Input({ label, hint, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      <input
        {...props}
        onWheel={(e) => e.currentTarget.blur()}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
      />
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Textarea({ label, hint, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      <textarea
        {...props}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
      />
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
    </div>
  );
}

export function Select({ label, hint, children, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      <select
        {...props}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
      >
        {children}
      </select>
      {hint && <p className="text-xs text-ink-muted mt-1">{hint}</p>}
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
