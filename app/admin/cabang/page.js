"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Modal, Toggle, EmptyState, Badge } from "@/components/ui/kit";

const empty = { id: null, name: "", address: "", phone: "", active: true };

export default function CabangPage() {
  const supabase = createClient();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("branches").select("*").order("created_at", { ascending: true });
    setRows(data || []);
    setLoading(false);
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Nama cabang wajib diisi");
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), address: form.address || null, phone: form.phone || null, active: form.active };
      const { error } = form.id
        ? await supabase.from("branches").update(payload).eq("id", form.id)
        : await supabase.from("branches").insert(payload);
      if (error) throw error;
      toast.success("Cabang disimpan");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Nonaktifkan cabang ini? Transaksi & kasir yang sudah tertaut ke cabang ini tidak akan terhapus.")) return;
    try {
      // Dinonaktifkan, bukan dihapus permanen — supaya riwayat transaksi &
      // kasir yang sudah tertaut ke cabang ini tetap valid (tidak yatim).
      const { error } = await supabase.from("branches").update({ active: false }).eq("id", id);
      if (error) throw error;
      toast.success("Cabang dinonaktifkan");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Cabang</h1>
          <p className="text-sm text-ink-muted">
            Kelola daftar cabang toko. Setiap kasir bisa ditugaskan ke satu cabang (di halaman Pengguna), dan
            transaksinya otomatis tercatat milik cabang itu untuk laporan.
          </p>
        </div>
        <Button onClick={() => { setForm(empty); setModalOpen(true); }}>+ Cabang Baru</Button>
      </div>

      <Card>
        <p className="text-xs text-ink-muted mb-3">
          Stok barang sudah dipisah per cabang (kelola di halaman Produk &amp; Harga, pilih cabangnya dulu). Produk baru
          otomatis dapat stok 0 di semua cabang aktif — isi manual per cabang setelah itu.
        </p>
        {loading ? (
          <p className="text-sm text-ink-muted">Memuat...</p>
        ) : rows.length === 0 ? (
          <EmptyState text="Belum ada cabang." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Nama Cabang</th>
                  <th className="text-left py-2 pr-3 font-medium">Alamat</th>
                  <th className="text-left py-2 pr-3 font-medium">Telepon</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-medium">{b.name}</td>
                    <td className="py-2.5 pr-3 text-ink-muted">{b.address || "-"}</td>
                    <td className="py-2.5 pr-3 text-ink-muted">{b.phone || "-"}</td>
                    <td className="py-2.5 pr-3"><Badge tone={b.active ? "primary" : "default"}>{b.active ? "Aktif" : "Nonaktif"}</Badge></td>
                    <td className="py-2.5 text-right space-x-2">
                      <Button variant="ghost" onClick={() => { setForm(b); setModalOpen(true); }}>Edit</Button>
                      {b.active && <Button variant="danger" onClick={() => remove(b.id)}>Nonaktifkan</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalOpen && (
        <Modal title={form.id ? "Edit Cabang" : "Cabang Baru"} onClose={() => setModalOpen(false)}>
          <div className="space-y-3">
            <Input label="Nama Cabang" placeholder="Cabang Sambas" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Alamat" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input label="Telepon" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Cabang aktif" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
