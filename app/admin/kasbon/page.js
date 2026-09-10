"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDate } from "@/lib/format";
import { Button, Card, EmptyState, Badge, Modal, Input } from "@/components/ui/kit";

export default function KasbonPage() {
  const supabase = createClient();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payModal, setPayModal] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("kasbon")
      .select("*, customers(name, phone)")
      .order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  }

  async function submitPayment() {
    if (!payAmount || Number(payAmount) <= 0) return toast.error("Isi nominal pembayaran");
    const sisaHutang = Number(payModal.amount) - Number(payModal.paid_amount);
    if (Number(payAmount) > sisaHutang) {
      return toast.error(`Nominal melebihi sisa hutang (${formatRupiah(sisaHutang)}). Periksa kembali.`);
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      await supabase.from("kasbon_payments").insert({
        kasbon_id: payModal.id,
        amount: Number(payAmount),
        received_by: userData?.user?.id,
      });
      const newPaid = Number(payModal.paid_amount) + Number(payAmount);
      const status = newPaid >= Number(payModal.amount) ? "lunas" : "belum_lunas";
      await supabase.from("kasbon").update({ paid_amount: newPaid, status }).eq("id", payModal.id);
      toast.success("Pembayaran cicilan dicatat");
      setPayModal(null);
      setPayAmount("");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const totalOutstanding = rows.filter((r) => r.status === "belum_lunas").reduce((s, r) => s + (Number(r.amount) - Number(r.paid_amount)), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Kasbon Pelanggan</h1>
        <p className="text-sm text-ink-muted">Pantau hutang pelanggan, nota jatuh tempo, dan terima pembayaran cicilan.</p>
      </div>

      <Card>
        <p className="text-xs text-ink-muted mb-1">Total Kasbon Belum Lunas</p>
        <p className="text-2xl font-semibold text-danger">{formatRupiah(totalOutstanding)}</p>
      </Card>

      <Card title="Daftar Kasbon">
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : rows.length === 0 ? (
          <EmptyState text="Belum ada kasbon." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Pelanggan</th>
                  <th className="text-right py-2 pr-3 font-medium">Total</th>
                  <th className="text-right py-2 pr-3 font-medium">Terbayar</th>
                  <th className="text-right py-2 pr-3 font-medium">Sisa</th>
                  <th className="text-left py-2 pr-3 font-medium">Jatuh Tempo</th>
                  <th className="text-left py-2 pr-3 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3">
                      <p>{r.customers?.name}</p>
                      <p className="text-xs text-ink-muted">{r.customers?.phone}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(r.amount)}</td>
                    <td className="py-2.5 pr-3 text-right">{formatRupiah(r.paid_amount)}</td>
                    <td className="py-2.5 pr-3 text-right font-medium">{formatRupiah(Number(r.amount) - Number(r.paid_amount))}</td>
                    <td className="py-2.5 pr-3">{r.due_date ? formatDate(r.due_date) : "-"}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={r.status === "lunas" ? "primary" : "danger"}>{r.status === "lunas" ? "Lunas" : "Belum Lunas"}</Badge>
                    </td>
                    <td className="py-2.5 text-right">
                      {r.status !== "lunas" && (
                        <Button variant="outline" onClick={() => setPayModal(r)}>Terima Bayar</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {payModal && (
        <Modal title={`Terima Pembayaran - ${payModal.customers?.name}`} onClose={() => setPayModal(null)}>
          <p className="text-sm text-ink-muted mb-3">
            Sisa hutang: <span className="font-medium text-ink">{formatRupiah(Number(payModal.amount) - Number(payModal.paid_amount))}</span>
          </p>
          <Input label="Jumlah Bayar" type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setPayModal(null)}>Batal</Button>
            <Button onClick={submitPayment} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pembayaran"}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
