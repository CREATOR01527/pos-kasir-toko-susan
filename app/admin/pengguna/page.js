"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/format";
import { Button, Card, Input, Modal, Select, Toggle, EmptyState, Badge } from "@/components/ui/kit";

const empty = { id: null, full_name: "", username: "", role: "kasir", password: "", default_opening_cash: "0", active: true };

export default function PenggunaPage() {
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
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  async function save() {
    if (!form.full_name || !form.username) return toast.error("Nama dan username wajib diisi");
    if (!form.id && !form.password) return toast.error("Password wajib diisi untuk akun baru");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          form.id
            ? { id: form.id, full_name: form.full_name, role: form.role, active: form.active, default_opening_cash: form.default_opening_cash, password: form.password || undefined }
            : { full_name: form.full_name, username: form.username, role: form.role, password: form.password, default_opening_cash: form.default_opening_cash }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      toast.success("Pengguna disimpan");
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Hapus pengguna ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Pengguna dihapus");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pengguna</h1>
          <p className="text-sm text-ink-muted">Kelola akun admin dan kasir beserta hak aksesnya.</p>
        </div>
        <Button onClick={() => { setForm(empty); setModalOpen(true); }}>+ Pengguna Baru</Button>
      </div>

      <Card>
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : rows.length === 0 ? (
          <EmptyState text="Belum ada pengguna." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Nama</th>
                  <th className="text-left py-2 pr-3 font-medium">Username</th>
                  <th className="text-left py-2 pr-3 font-medium">Peran</th>
                  <th className="text-right py-2 pr-3 font-medium">Modal Awal</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">{u.full_name}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{u.username}</td>
                    <td className="py-2.5 pr-3 capitalize">{u.role}</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(u.default_opening_cash)}</td>
                    <td className="py-2.5 pr-3"><Badge tone={u.active ? "primary" : "default"}>{u.active ? "Aktif" : "Nonaktif"}</Badge></td>
                    <td className="py-2.5 text-right space-x-2">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setForm({ id: u.id, full_name: u.full_name, username: u.username, role: u.role, password: "", default_opening_cash: String(u.default_opening_cash), active: u.active });
                          setModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => remove(u.id)}>Hapus</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modalOpen && (
        <Modal title={form.id ? "Edit Pengguna" : "Pengguna Baru"} onClose={() => setModalOpen(false)}>
          <div className="space-y-3">
            <Input label="Nama Lengkap" placeholder="Siti Aminah" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input
              label="Username"
              placeholder="siti"
              value={form.username}
              disabled={!!form.id}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
              hint="Huruf kecil, minimal 3 karakter. Tidak bisa diubah setelah dibuat."
            />
            <Select label="Peran" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="kasir">Kasir — terbatas</option>
              <option value="admin">Admin — akses penuh</option>
            </Select>
            <Input
              label="Modal Awal (Rp)"
              type="number"
              value={form.default_opening_cash}
              onChange={(e) => setForm({ ...form, default_opening_cash: e.target.value })}
              hint={form.role === "admin" ? "Dipakai kalau admin membuka layar Kasir sendiri." : undefined}
            />
            <Input
              label={form.id ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}
              type="password"
              placeholder="••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Akun aktif" />
            <p className="text-xs text-ink-muted">Akun nonaktif tidak bisa masuk ke aplikasi.</p>
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
