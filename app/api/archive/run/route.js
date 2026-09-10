import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getServiceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function runArchive(service, triggerType, triggeredBy) {
  const { data: settings } = await service.from("archive_settings").select("*").eq("id", 1).single();
  if (!settings) return { archived: 0, skipped: "pengaturan arsip tidak ditemukan" };

  if (triggerType === "otomatis") {
    if (!settings.auto_enabled) return { archived: 0, skipped: "arsip otomatis dimatikan" };
    if (settings.last_run_at) {
      const daysSince = (Date.now() - new Date(settings.last_run_at).getTime()) / 86400000;
      if (daysSince < settings.frequency_days) {
        return { archived: 0, skipped: `belum waktunya (baru ${Math.floor(daysSince)} hari dari ${settings.frequency_days} hari)` };
      }
    }
  }

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - settings.archive_after_months);

  const { data: rows, error } = await service
    .from("transactions")
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq("archived", false)
    .lt("created_at", cutoff.toISOString())
    .select("id");

  if (error) throw error;

  const count = rows?.length || 0;

  await service.from("archive_settings").update({ last_run_at: new Date().toISOString() }).eq("id", 1);
  await service.from("archive_runs").insert({
    trigger_type: triggerType,
    rows_archived: count,
    triggered_by: triggeredBy || null,
  });

  return { archived: count };
}

// Dipicu manual oleh admin lewat halaman Arsip Data
export async function POST() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile || profile.role !== "admin" || !profile.active) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  try {
    const service = getServiceClient();
    const result = await runArchive(service, "manual", user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Dipanggil otomatis oleh Vercel Cron (lihat vercel.json) — diautentikasi via CRON_SECRET,
// bukan sesi login, karena tidak ada pengguna yang login saat cron berjalan.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }

  try {
    const service = getServiceClient();
    const result = await runArchive(service, "otomatis", null);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
