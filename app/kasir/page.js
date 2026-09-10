import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KasirApp from "./KasirApp";

export default async function KasirPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: myProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!myProfile || !myProfile.active) redirect("/login");

  // Admin bisa membuka layar kasir atas nama akun kasir tertentu lewat ?as=<id>,
  // dipilih dari halaman Buka Kasir. Transaksi tercatat atas nama akun tersebut.
  const params = await searchParams;
  const asId = params?.as;
  let profile = myProfile;
  let impersonating = false;

  if (asId && myProfile.role === "admin") {
    const { data: targetProfile } = await supabase.from("profiles").select("*").eq("id", asId).eq("active", true).single();
    if (targetProfile) {
      profile = targetProfile;
      impersonating = true;
    }
  }

  const { data: openShift } = await supabase
    .from("shifts")
    .select("*")
    .eq("cashier_id", profile.id)
    .eq("status", "open")
    .order("opening_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [{ data: products }, { data: customers }, { data: settings }, { data: pendingTx }] =
    await Promise.all([
      supabase
        .from("products")
        .select(
          "*, product_wholesale_pricing(*), product_kg_pricing(*), product_out_of_town_pricing(*), product_barcodes(*)"
        )
        .eq("active", true)
        .order("name"),
      supabase.from("customers").select("*").eq("active", true).order("name"),
      supabase.from("store_settings").select("*").eq("id", 1).single(),
      supabase
        .from("transactions")
        .select("*, transaction_items(*, products(name))")
        .eq("cashier_id", profile.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

  return (
    <KasirApp
      profile={profile}
      isAdminAccount={myProfile.role === "admin"}
      impersonating={impersonating}
      initialShift={openShift || null}
      products={products || []}
      customers={customers || []}
      settings={settings || null}
      pendingTransactions={pendingTx || []}
    />
  );
}
