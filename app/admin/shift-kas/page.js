"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDateTime } from "@/lib/format";
import { Button, Card, Input, Modal, Select, Textarea, EmptyState, Badge, StatCard } from "@/components/ui/kit";

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default function ShiftKasPage() {
  const supabase = createClient();
  const [cashiers, setCashiers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [cashMovements, setCashMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editCashier, setEditCashier] = useState(null);
  const [amount, setAmount] = useState("");
  const [expenseModal, setExpenseModal] = useState(false);
  const [expForm, setExpForm] = useState({ type: "keluar", category: "", description: "", amount: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: s }, { data: cm }] = await Promise.all([
      supabase.from("profiles").select("*").eq("role", "kasir").order("full_name"),
      supabase.from("shifts").select("*, profiles(full_name)").order("opening_time", { ascending: false }).limit(50),
      supabase.from("cash_movements").select("*, profiles(full_name)").order("movement_date", { ascending: false }).limit(50),
    ]);
    setCashiers(c || []);
    setShifts(s || []);
    setCashMovements(cm || []);
    setLoading(false);
  }

  async function saveOpeningCash() {
    setSaving(true);
    try {
      await supabase.from("profiles").update({ default_opening_cash: Number(amount) || 0 }).eq("id", editCashier.id);
      toast.success("Modal awal kasir diperbarui");
      setEditCashier(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function submitExpense() {
    if (!expForm.description || !expForm.amount) return toast.error("Lengkapi deskripsi dan nominal");
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("cash_movements").insert({
        type: expForm.type,
        category: expForm.category || null,
        description: expForm.description,
        amount: Number(expForm.amount),
        created_by: userData?.user?.id,
      });
      toast.success("Dicatat");
      setExpenseModal(false);
      setExpForm({ type: "keluar", category: "", description: "", amount: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteMovement(id) {
    if (!confirm("Hapus catatan ini?")) return;
    await supabase.from("cash_movements").delete().eq("id", id);
    load();
  }

  const monthMovements = cashMovements.filter((m) => m.movement_date >= startOfMonth());
  const monthExpense = monthMovements.filter((m) => m.type === "keluar").reduce((s, m) => s + Number(m.amount), 0);
  const monthIncome = monthMovements.filter((m) => m.type === "masuk").reduce((s, m) => s + Number(m.amount), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Shift & Kas</h1>
        <p className="text-sm text-ink-muted">Atur modal awal tiap kasir, kas & pengeluaran toko, dan riwayat shift.</p>
      </div>

      <Card title="Modal Awal per Akun Kasir">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cashiers.map((c) => (
            <div key={c.id} className="border border-border rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{c.full_name}</p>
                <p className="text-lg font-semibold text-primary">{formatRupiah(c.default_opening_cash)}</p>
              </div>
              <Button variant="outline" onClick={() => { setEditCashier(c); setAmount(String(c.default_opening_cash)); }}>Ubah</Button>
            </div>
          ))}
          {cashiers.length === 0 && <EmptyState text="Belum ada akun kasir." />}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Pengeluaran Bulan Ini" value={formatRupiah(monthExpense)} tone="danger" />
        <StatCard label="Kas Masuk Bulan Ini" value={formatRupiah(monthIncome)} tone="primary" />
      </div>

      <Card
        title="Kas & Pengeluaran Toko"
        action={<Button onClick={() => setExpenseModal(true)}>+ Tambah Catatan</Button>}
      >
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : cashMovements.length === 0 ? (
          <EmptyState text="Belum ada catatan kas." />
        ) : (
          <div className="space-y-2">
            {cashMovements.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm py-2 border-b border-border last:border-0">
                <div>
                  {m.category && <p className="text-xs text-ink-muted">{m.category}</p>}
                  <p className="font-medium">{m.description}</p>
                  <p className="text-xs text-ink-muted">{formatDateTime(m.movement_date)} · {m.profiles?.full_name || "Pemilik Toko"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={m.type === "keluar" ? "text-danger font-medium" : "text-primary font-medium"}>
                    {m.type === "keluar" ? "-" : "+"}{formatRupiah(m.amount)}
                  </span>
                  <button onClick={() => deleteMovement(m.id)} className="text-xs text-ink-muted hover:text-danger">Hapus</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Riwayat Shift (Semua Kasir)">
        {shifts.length === 0 ? <EmptyState text="Belum ada riwayat shift." /> : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Kasir</th>
                  <th className="text-right py-2 pr-3 font-medium">Modal Awal</th>
                  <th className="text-left py-2 pr-3 font-medium">Mulai</th>
                  <th className="text-right py-2 pr-3 font-medium">Kas Akhir</th>
                  <th className="text-left py-2 pr-3 font-medium">Selesai</th>
                  <th className="text-left py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">{s.profiles?.full_name}</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(s.opening_cash)}</td>
                    <td className="py-2.5 pr-3">{formatDateTime(s.opening_time)}</td>
                    <td className="py-2.5 pr-3 text-right">{s.closing_cash != null ? formatRupiah(s.closing_cash) : "-"}</td>
                    <td className="py-2.5 pr-3">{s.closing_time ? formatDateTime(s.closing_time) : "-"}</td>
                    <td className="py-2.5"><Badge tone={s.status === "open" ? "primary" : "default"}>{s.status === "open" ? "Berjalan" : "Selesai"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editCashier && (
        <Modal title={`Modal Awal - ${editCashier.full_name}`} onClose={() => setEditCashier(null)}>
          <Input label="Jumlah Modal Awal (Rp)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditCashier(null)}>Batal</Button>
            <Button onClick={saveOpeningCash} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </Modal>
      )}

      {expenseModal && (
        <Modal title="Tambah Catatan Kas" onClose={() => setExpenseModal(false)}>
          <div className="space-y-3">
            <Select label="Jenis" value={expForm.type} onChange={(e) => setExpForm({ ...expForm, type: e.target.value })}>
              <option value="keluar">Kas Keluar / Pengeluaran</option>
              <option value="masuk">Kas Masuk</option>
            </Select>
            <Input label="Kategori (opsional)" placeholder="mis. Plastik & Kemasan" value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} />
            <Textarea label="Deskripsi" placeholder="mis. Kantong plastik 2 pak" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} rows={2} />
            <Input label="Nominal (Rp)" type="number" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setExpenseModal(false)}>Batal</Button>
            <Button onClick={submitExpense} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
