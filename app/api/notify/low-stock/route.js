import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatNumber } from "@/lib/format";

function getServiceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// isTest=true (tombol "Tes Kirim" di Pengaturan): abaikan toggle & anti-spam,
// supaya admin bisa langsung memastikan Bot Token/Chat ID sudah benar.
// isTest=false (dipicu kasir setelah checkout, atau cron harian): hormati
// toggle notif_low_stock_enabled dan anti-spam 20 jam per barang.
async function runLowStockCheck(service, { isTest = false } = {}) {
  const { data: settings } = await service.from("store_settings").select("*").eq("id", 1).single();
  if (!settings) return { sent: false, message: "Pengaturan toko tidak ditemukan" };
  if (!isTest && !settings.notif_low_stock_enabled) {
    return { sent: false, message: "Notifikasi stok menipis sedang dimatikan di Pengaturan" };
  }
  if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
    return { sent: false, message: "Bot Token / Chat ID Telegram belum diisi di Pengaturan" };
  }

  const { data: products } = await service
    .from("products")
    .select("id, name, stock_qty, min_stock, last_low_stock_notified_at")
    .eq("active", true)
    .gt("min_stock", 0);

  const now = Date.now();
  const due = (products || []).filter((p) => {
    if (Number(p.stock_qty) > Number(p.min_stock)) return false;
    if (isTest) return true;
    if (!p.last_low_stock_notified_at) return true;
    return now - new Date(p.last_low_stock_notified_at).getTime() > 20 * 3600 * 1000;
  });

  if (due.length === 0) {
    return {
      sent: false,
      message: isTest
        ? "Belum ada barang dengan stok menipis saat ini, jadi tidak ada contoh untuk dikirim."
        : "Tidak ada barang menipis baru",
    };
  }

  const lines = [`<b>⚠️ Stok Menipis — ${escapeHtml(settings.store_name || "Toko")}</b>`, ""];
  for (const p of due.slice(0, 30)) {
    lines.push(`• ${escapeHtml(p.name)}: sisa ${formatNumber(p.stock_qty, 2)} (min. ${formatNumber(p.min_stock, 2)})`);
  }
  if (due.length > 30) lines.push(`...dan ${due.length - 30} barang lainnya`);

  await sendTelegramMessage(settings.telegram_bot_token, settings.telegram_chat_id, lines.join("\n"));

  if (!isTest) {
    await service
      .from("products")
      .update({ last_low_stock_notified_at: new Date().toISOString() })
      .in("id", due.map((p) => p.id));
  }

  return { sent: true, message: `Terkirim ke Telegram (${due.length} barang)` };
}

// Dipicu manual dari tombol "Tes Kirim" di Pengaturan (body: {test:true}),
// atau otomatis di background setelah kasir checkout (tanpa body).
// Keduanya butuh sesi login aktif (admin ATAU kasir), bukan publik.
export async function POST(request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("active").eq("id", user.id).single();
  if (!profile?.active) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  let isTest = false;
  try {
    const body = await request.json();
    isTest = !!body?.test;
  } catch {
    // tidak ada body (dipicu otomatis dari kasir) — biarkan isTest=false
  }

  try {
    const service = getServiceClient();
    const result = await runLowStockCheck(service, { isTest });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Dipanggil otomatis oleh Vercel Cron (lihat vercel.json), diautentikasi via CRON_SECRET.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  try {
    const service = getServiceClient();
    const result = await runLowStockCheck(service, { isTest: false });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
