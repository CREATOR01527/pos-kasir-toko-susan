"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/format";
import { Button, Card, Input, Modal, Select, Textarea, Toggle, EmptyState, Badge } from "@/components/ui/kit";

const empty = {
  id: null,
  name: "",
  phone: "",
  address: "",
  customer_type: "Umum",
  discount_percent: "0",
  kasbon_limit: "0",
  notes: "",
  active: true,
};

export default function PelangganPage() {
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
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  async function save() {
    if (!form.name) return toast.error("Nama pelanggan wajib diisi");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || null,
        address: form.address || null,
        customer_type: form.customer_type || "Umum",
        discount_percent: Number(String(form.discount_percent).replace(",", ".")) || 0,
        kasbon_limit: Number(form.kasbon_limit) || 0,
        notes: form.notes || null,
        active: form.active,
      };
      if (form.id) await supabase.from("customers").update(payload).eq("id", form.id);
      else await supabase.from("customers").insert(payload);
      toast.success("Pelanggan disimpan");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Hapus pelanggan ini?")) return;
    await supabase.from("customers").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pelanggan</h1>
          <p className="text-sm text-ink-muted">Data pelanggan langganan, diskon khusus, dan batas kasbon.</p>
        </div>
        <Button onClick={() => { setForm(empty); setModalOpen(true); }}>+ Pelanggan Baru</Button>
      </div>

      <Card>
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : rows.length === 0 ? (
          <EmptyState text="Belum ada pelanggan." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Nama</th>
                  <th className="text-left py-2 pr-3 font-medium">Tipe</th>
                  <th className="text-right py-2 pr-3 font-medium">Diskon</th>
                  <th className="text-right py-2 pr-3 font-medium">Limit Kasbon</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">
                      <p>{c.name}</p>
                      <p className="text-xs text-ink-muted">{c.phone}</p>
                    </td>
                    <td className="py-2.5 pr-3">{c.customer_type}</td>
                    <td className="py-2.5 pr-3 text-right">{c.discount_percent}%</td>
                    <td className="py-2.5 pr-3 text-right">{c.kasbon_limit > 0 ? formatRupiah(c.kasbon_limit) : "Tanpa batas"}</td>
                    <td className="py-2.5 pr-3"><Badge tone={c.active ? "primary" : "default"}>{c.active ? "Aktif" : "Nonaktif"}</Badge></td>
                    <td className="py-2.5 text-right space-x-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setForm({ ...c, discount_percent: String(c.discount_percent), kasbon_limit: String(c.kasbon_limit) });
                          setModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => remove(c.id)}>Hapus</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalOpen && (
        <Modal title={form.id ? "Edit Pelanggan" : "Pelanggan Baru"} onClose={() => setModalOpen(false)}>
          <div className="space-y-3">
            <Input label="Nama Pelanggan" placeholder="Bu Sari Warung" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Nomor Telepon" placeholder="0812xxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Textarea label="Alamat" placeholder="Jl. Melati No. 5" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
            <Select label="Tipe Pelanggan" value={form.customer_type} onChange={(e) => setForm({ ...form, customer_type: e.target.value })}>
              <option value="Umum">Umum</option>
              <option value="Langganan">Langganan</option>
              <option value="Reseller">Reseller</option>
            </Select>
            <Input
              label="Diskon (%)"
              type="text"
              placeholder="0"
              value={form.discount_percent}
              onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
              hint="Diskon otomatis dipakai di kasir di atas harga grosir. Boleh desimal, mis. 2,5."
            />
            <Input
              label="Limit Kasbon (Rp)"
              type="number"
              value={form.kasbon_limit}
              onChange={(e) => setForm({ ...form, kasbon_limit: e.target.value })}
              hint="Isi 0 berarti tanpa batas kasbon."
            />
            <Textarea label="Catatan" placeholder="Langganan beras, biasa bayar tiap Sabtu." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Pelanggan aktif" />
            <p className="text-xs text-ink-muted">Pelanggan nonaktif tidak muncul di pilihan kasir.</p>
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
