"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah, formatDateTime, formatDate } from "@/lib/format";
import { Button, Card, Input, Toggle, EmptyState, Badge } from "@/components/ui/kit";

export default function ArsipPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState(null);
  const [runs, setRuns] = useState([]);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: r }, { data: a }] = await Promise.all([
      supabase.from("archive_settings").select("*").eq("id", 1).single(),
      supabase.from("archive_runs").select("*, profiles(full_name)").order("ran_at", { ascending: false }).limit(20),
      supabase
        .from("transactions")
        .select("id, total, created_at, archived_at, payment_method")
        .eq("archived", true)
        .order("archived_at", { ascending: false })
        .limit(50),
    ]);
    setSettings(s);
    setRuns(r || []);
    setArchived(a || []);
    setLoading(false);
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const { id, last_run_at, ...payload } = settings;
      await supabase.from("archive_settings").update(payload).eq("id", 1);
      toast.success("Pengaturan arsip disimpan");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    setRunning(true);
    try {
      const res = await fetch("/api/archive/run", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Selesai. ${json.archived} transaksi diarsipkan.`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  }

  if (!settings) return <p className="text-sm text-ink-muted">Memuat...</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Arsip Data</h1>
        <p className="text-sm text-ink-muted">
          Transaksi lama ditandai sebagai arsip supaya laporan harian tetap ringkas — datanya
          tidak dihapus dan tetap bisa dibuka kapan saja di halaman ini.
        </p>
      </div>

      <Card title="Pengaturan Arsip">
        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Input
            label="Arsipkan Transaksi Lebih Lama Dari (bulan)"
            type="number"
            value={settings.archive_after_months}
            onChange={(e) => setSettings({ ...settings, archive_after_months: Number(e.target.value) })}
          />
          <Input
            label="Cek Ulang Setiap (hari) — untuk mode otomatis"
            type="number"
            value={settings.frequency_days}
            onChange={(e) => setSettings({ ...settings, frequency_days: Number(e.target.value) })}
          />
        </div>
        <Toggle
          checked={settings.auto_enabled}
          onChange={(v) => setSettings({ ...settings, auto_enabled: v })}
          label="Jalankan arsip otomatis sesuai jadwal di atas"
        />
        <p className="text-xs text-ink-muted mt-1 mb-4">
          Jika dimatikan, arsip hanya berjalan saat Anda klik "Jalankan Sekarang" secara manual.
        </p>
        {settings.last_run_at && (
          <p className="text-xs text-ink-muted mb-4">Terakhir dijalankan: {formatDateTime(settings.last_run_at)}</p>
        )}
        <div className="flex gap-2">
          <Button onClick={saveSettings} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
          <Button variant="outline" onClick={runNow} disabled={running}>{running ? "Memproses..." : "Jalankan Sekarang"}</Button>
        </div>
      </Card>

      <Card title="Riwayat Proses Arsip">
        {runs.length === 0 ? (
          <EmptyState text="Belum pernah dijalankan." />
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                <div>
                  <p>{formatDateTime(r.ran_at)} <Badge tone={r.trigger_type === "otomatis" ? "primary" : "default"} className="ml-1">{r.trigger_type}</Badge></p>
                  <p className="text-xs text-ink-muted">{r.profiles?.full_name || "Sistem (terjadwal)"}</p>
                </div>
                <span className="text-sm font-medium">{r.rows_archived} transaksi</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Data yang Sudah Diarsipkan (50 terbaru)">
        {loading ? <p className="text-sm text-ink-muted">Memuat...</p> : archived.length === 0 ? (
          <EmptyState text="Belum ada data yang diarsipkan." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted border-b border-border">
                <tr>
                  <th className="text-left py-2 pr-3 font-medium">Tanggal Transaksi</th>
                  <th className="text-right py-2 pr-3 font-medium">Total</th>
                  <th className="text-left py-2 pr-3 font-medium">Metode</th>
                  <th className="text-left py-2 font-medium">Diarsipkan Pada</th>
                </tr>
              </thead>
              <tbody>
                {archived.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">{formatDateTime(t.created_at)}</td>
                    <td className="py-2 pr-3 text-right">{formatRupiah(t.total)}</td>
                    <td className="py-2 pr-3 capitalize">{t.payment_method}</td>
                    <td className="py-2">{formatDate(t.archived_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
