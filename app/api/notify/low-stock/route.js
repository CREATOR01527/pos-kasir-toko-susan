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

  const { data: rows } = await service
    .from("product_branch_stock")
    .select("product_id, stock_qty, min_stock, products(id, name, active, last_low_stock_notified_at), branches(name)")
    .gt("min_stock", 0);

  const now = Date.now();
  const due = (rows || []).filter((r) => {
    if (!r.products?.active) return false;
    if (Number(r.stock_qty) > Number(r.min_stock)) return false;
    if (isTest) return true;
    const lastNotified = r.products?.last_low_stock_notified_at;
    if (!lastNotified) return true;
    return now - new Date(lastNotified).getTime() > 20 * 3600 * 1000;
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
  for (const r of due.slice(0, 30)) {
    const branchNote = due.some((x) => x.branches?.name !== due[0].branches?.name) && r.branches?.name ? ` [${escapeHtml(r.branches.name)}]` : "";
    lines.push(`• ${escapeHtml(r.products?.name || "-")}${branchNote}: sisa ${formatNumber(r.stock_qty, 2)} (min. ${formatNumber(r.min_stock, 2)})`);
  }
  if (due.length > 30) lines.push(`...dan ${due.length - 30} baris lainnya`);

  await sendTelegramMessage(settings.telegram_bot_token, settings.telegram_chat_id, lines.join("\n"));

  if (!isTest) {
    const productIds = [...new Set(due.map((r) => r.product_id))];
    await service
      .from("products")
      .update({ last_low_stock_notified_at: new Date().toISOString() })
      .in("id", productIds);
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
