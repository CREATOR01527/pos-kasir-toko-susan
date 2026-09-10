"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Modal, Textarea, Toggle, EmptyState, Badge } from "@/components/ui/kit";

const empty = { id: null, name: "", contact_person: "", phone: "", address: "", notes: "", active: true };

export default function SupplierPage() {
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
    const { data } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  async function save() {
    if (!form.name) return toast.error("Nama supplier wajib diisi");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        contact_person: form.contact_person || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
        active: form.active,
      };
      if (form.id) await supabase.from("suppliers").update(payload).eq("id", form.id);
      else await supabase.from("suppliers").insert(payload);
      toast.success("Supplier disimpan");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Hapus supplier ini?")) return;
    await supabase.from("suppliers").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Supplier</h1>
          <p className="text-sm text-ink-muted">Kelola data pemasok toko, dipakai saat membuat pesanan pembelian.</p>
        </div>
        <Button onClick={() => { setForm(empty); setModalOpen(true); }}>+ Supplier Baru</Button>
      </div>

      <Card>
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : rows.length === 0 ? (
          <EmptyState text="Belum ada supplier." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((s) => (
              <div key={s.id} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{s.name}</p>
                  <Badge tone={s.active ? "primary" : "default"}>{s.active ? "Aktif" : "Nonaktif"}</Badge>
                </div>
                <p className="text-xs text-ink-muted">{s.contact_person} · {s.phone}</p>
                <p className="text-xs text-ink-muted mt-1">{s.address}</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" onClick={() => { setForm(s); setModalOpen(true); }}>Edit</Button>
                  <Button variant="danger" onClick={() => remove(s.id)}>Hapus</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modalOpen && (
        <Modal title={form.id ? "Edit Supplier" : "Supplier Baru"} onClose={() => setModalOpen(false)}>
          <div className="space-y-3">
            <Input label="Nama Supplier" placeholder="CV Sumber Rejeki" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Kontak Person" placeholder="Pak Budi" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            <Input label="Telepon" placeholder="0812xxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Textarea label="Alamat" placeholder="Jl. Pasar Baru No. 12, Surabaya" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            <Textarea label="Catatan" placeholder="Kirim setiap hari Senin, tempo 14 hari" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Supplier aktif" />
            <p className="text-xs text-ink-muted">Supplier nonaktif tidak muncul saat membuat pesanan baru.</p>
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
