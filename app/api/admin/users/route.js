import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getServiceClient() {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
  if (!profile || profile.role !== "admin" || !profile.active) return null;
  return user;
}

// Membuat pengguna baru (auth user + profil)
export async function POST(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  const body = await request.json();
  const { full_name, username, role, password, default_opening_cash } = body;

  if (!full_name || !username || !password) {
    return NextResponse.json({ error: "Lengkapi semua data wajib" }, { status: 400 });
  }
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    return NextResponse.json({ error: "Username harus huruf kecil, minimal 3 karakter" }, { status: 400 });
  }

  const service = getServiceClient();
  const email = `${username}@kasir.local`;

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

  const { error: profileErr } = await service.from("profiles").insert({
    id: created.user.id,
    full_name,
    username,
    role: role === "admin" ? "admin" : "kasir",
    active: true,
    default_opening_cash: Number(default_opening_cash) || 0,
  });

  if (profileErr) {
    await service.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: created.user.id });
}

// Update profil / status aktif / role / password
export async function PATCH(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  const body = await request.json();
  const { id, full_name, role, active, default_opening_cash, password } = body;
  if (!id) return NextResponse.json({ error: "ID pengguna wajib" }, { status: 400 });

  const service = getServiceClient();

  const patch = {};
  if (full_name !== undefined) patch.full_name = full_name;
  if (role !== undefined) patch.role = role;
  if (active !== undefined) patch.active = active;
  if (default_opening_cash !== undefined) patch.default_opening_cash = Number(default_opening_cash) || 0;

  if (Object.keys(patch).length > 0) {
    const { error } = await service.from("profiles").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (password) {
    const { error } = await service.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// Hapus pengguna
export async function DELETE(request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "ID pengguna wajib" }, { status: 400 });

  const service = getServiceClient();
  await service.from("profiles").delete().eq("id", id);
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
