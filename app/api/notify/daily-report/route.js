import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatRupiah } from "@/lib/format";

function getServiceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PAYMENT_LABELS = { tunai: "Tunai", transfer: "Transfer", qris: "QRIS", kasbon: "Kasbon" };

async function buildDailyReportText(service, settings) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: txs } = await service
    .from("transactions")
    .select("total, tax_amount, payment_method")
    .eq("status", "completed")
    .gte("created_at", startOfDay.toISOString());

  const rows = txs || [];
  const totalOmzet = rows.reduce((s, t) => s + Number(t.total || 0), 0);
  const totalTax = rows.reduce((s, t) => s + Number(t.tax_amount || 0), 0);

  const byMethod = {};
  for (const t of rows) {
    const key = t.payment_method || "tunai";
    byMethod[key] = (byMethod[key] || 0) + Number(t.total || 0);
  }

  const lines = [
    `<b>📊 Laporan Penjualan Harian — ${escapeHtml(settings.store_name || "Toko")}</b>`,
    new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }),
    "",
    `Jumlah transaksi: ${rows.length}`,
    `Total omzet: ${formatRupiah(totalOmzet)}`,
  ];
  if (totalTax > 0) lines.push(`Termasuk pajak: ${formatRupiah(totalTax)}`);

  if (Object.keys(byMethod).length > 0) {
    lines.push("");
    lines.push("Rincian per metode bayar:");
    for (const [method, amt] of Object.entries(byMethod)) {
      lines.push(`• ${PAYMENT_LABELS[method] || method}: ${formatRupiah(amt)}`);
    }
  }

  return lines.join("\n");
}

async function runDailyReport(service, { isTest = false } = {}) {
  const { data: settings } = await service.from("store_settings").select("*").eq("id", 1).single();
  if (!settings) return { sent: false, message: "Pengaturan toko tidak ditemukan" };
  if (!isTest && !settings.notif_daily_report_enabled) {
    return { sent: false, message: "Laporan harian otomatis sedang dimatikan di Pengaturan" };
  }
  if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
    return { sent: false, message: "Bot Token / Chat ID Telegram belum diisi di Pengaturan" };
  }

  const text = await buildDailyReportText(service, settings);
  await sendTelegramMessage(settings.telegram_bot_token, settings.telegram_chat_id, text);
  return { sent: true, message: "Laporan harian terkirim ke Telegram" };
}

// Tombol "Tes Kirim" di Pengaturan (body: {test:true}) — hanya admin.
export async function POST(request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile?.active || profile.role !== "admin") {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  let isTest = false;
  try {
    const body = await request.json();
    isTest = !!body?.test;
  } catch {}

  try {
    const service = getServiceClient();
    const result = await runDailyReport(service, { isTest });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Dipanggil otomatis oleh Vercel Cron (lihat vercel.json) sekali sehari ±21:00 WIB.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  try {
    const service = getServiceClient();
    const result = await runDailyReport(service, { isTest: false });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
