"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input } from "@/components/ui/kit";
import { Search, Hash, PauseCircle, RotateCcw, CreditCard, PackageOpen } from "lucide-react";

const ACTIONS = [
  { key: "search", label: "Cari Barang", desc: "Fokus ke kolom pencarian produk (kalau barcode/scanner error)", icon: Search },
  { key: "qty", label: "Ubah Qty", desc: "Ubah jumlah item yang sedang dipilih di keranjang", icon: Hash },
  { key: "hold", label: "Tahan Transaksi", desc: "Menahan keranjang saat ini, kosongkan layar untuk transaksi lain", icon: PauseCircle },
  { key: "recall", label: "Panggil Transaksi Ditahan", desc: "Memanggil kembali transaksi yang sebelumnya ditahan", icon: RotateCcw },
  { key: "pay", label: "Bayar", desc: "Langsung buka jendela pembayaran / checkout", icon: CreditCard },
  { key: "drawer", label: "Buka Laci", desc: "Membuka laci kasir lewat printer thermal yang terhubung", icon: PackageOpen },
];

const DEFAULTS = { search: "F2", qty: "F4", hold: "F7", recall: "F8", pay: "F12", drawer: "F6" };

export default function KasirShortcutPage() {
  const supabase = createClient();
  const [hotkeys, setHotkeys] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("store_settings").select("action_hotkeys").eq("id", 1).single();
    setHotkeys({ ...DEFAULTS, ...(data?.action_hotkeys || {}) });
  }

  async function save() {
    const values = Object.values(hotkeys).map((v) => v.toUpperCase());
    const hasDuplicate = new Set(values).size !== values.length;
    if (hasDuplicate) return toast.error("Ada tombol yang dipakai dua kali — tiap aksi harus punya tombol berbeda");

    setSaving(true);
    try {
      const { error } = await supabase.from("store_settings").update({ action_hotkeys: hotkeys }).eq("id", 1);
      if (error) throw error;
      toast.success("Shortcut aksi kasir disimpan");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!hotkeys) return <p className="text-sm text-ink-muted">Memuat...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Shortcut Kasir</h1>
        <p className="text-sm text-ink-muted">
          Atur tombol keyboard untuk aksi-aksi penting di layar kasir — buka laci, tahan transaksi,
          panggil transaksi yang ditahan, cari produk (kalau barcode/scanner bermasalah), dan bayar.
          Tampil sebagai daftar di sidebar halaman kasir, di sebelah keranjang.
        </p>
      </div>

      <Card title="Tombol untuk Tiap Aksi">
        <div className="space-y-3">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.key} className="flex items-center gap-4 border border-border rounded-xl px-4 py-3">
                <Icon size={18} className="text-ink-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-ink-muted">{a.desc}</p>
                </div>
                <Input
                  value={hotkeys[a.key] || ""}
                  onChange={(e) => setHotkeys({ ...hotkeys, [a.key]: e.target.value.toUpperCase() })}
                  className="w-24 shrink-0"
                  placeholder="mis. F2"
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink-muted mt-3">
          Gunakan nama tombol keyboard standar, mis. <code>F2</code>, <code>F6</code>, <code>F12</code>.
          Tiap aksi harus punya tombol yang berbeda.
        </p>
        <div className="flex justify-end mt-4">
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Shortcut"}</Button>
        </div>
      </Card>

      <Card title="Catatan: Buka Laci">
        <p className="text-sm text-ink-muted">
          Fitur "Buka Laci" mengirim perintah langsung ke printer struk thermal yang punya port
          untuk laci (RJ11) — cara ini yang umum dipakai laci kasir. Ini hanya berjalan di browser
          <strong> Chrome atau Edge di komputer/laptop</strong> (belum didukung di HP atau Safari/Firefox).
          Saat pertama kali dipakai, kasir akan diminta memilih printer/port sekali — setelah itu
          browser akan mengingatnya otomatis.
        </p>
      </Card>
    </div>
  );
}
