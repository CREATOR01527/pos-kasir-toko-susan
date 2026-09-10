"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/format";
import { Button, Card, EmptyState, Badge } from "@/components/ui/kit";

export default function AdminKasirPickerPage() {
  const supabase = createClient();
  const router = useRouter();
  const [cashiers, setCashiers] = useState([]);
  const [shifts, setShifts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: c } = await supabase.from("profiles").select("*").eq("role", "kasir").eq("active", true).order("full_name");
    const { data: openShifts } = await supabase.from("shifts").select("cashier_id, opening_time").eq("status", "open");
    const map = {};
    (openShifts || []).forEach((s) => (map[s.cashier_id] = s));
    setShifts(map);
    setCashiers(c || []);
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Buka Kasir</h1>
        <p className="text-sm text-ink-muted">
          Buka layar kasir sebagai akun Anda sendiri, atau pilih salah satu akun kasir di bawah untuk
          membuka layarnya (mis. untuk membantu shift, uji coba, atau setup awal). Transaksi akan
          tercatat atas nama akun yang dipilih.
        </p>
      </div>

      <Card title="Buka Sebagai Diri Sendiri (Admin)">
        <Button onClick={() => router.push("/kasir")}>Buka Kasir — Akun Saya</Button>
      </Card>

      <Card title="Buka Sebagai Akun Kasir">
        {loading ? (
          <p className="text-sm text-ink-muted">Memuat...</p>
        ) : cashiers.length === 0 ? (
          <EmptyState text="Belum ada akun kasir. Buat dulu di menu Pengguna." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cashiers.map((c) => {
              const activeShift = shifts[c.id];
              return (
                <div key={c.id} className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{c.full_name}</p>
                    {activeShift && <Badge tone="primary">Shift Berjalan</Badge>}
                  </div>
                  <p className="text-xs text-ink-muted mb-3">Modal awal: {formatRupiah(c.default_opening_cash)}</p>
                  <Button variant="outline" onClick={() => router.push(`/kasir?as=${c.id}`)} className="w-full">
                    Buka Kasir Ini
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
