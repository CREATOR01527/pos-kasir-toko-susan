import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Manifest PWA ini sengaja dibuat DINAMIS (bukan file statis di /public)
// supaya admin bisa ganti ikon aplikasi sendiri lewat Pengaturan Toko,
// tanpa perlu edit kode/deploy ulang setiap kali mau ganti logo.
//
// store_settings boleh dibaca publik (lihat schema.sql: store_settings_select
// pakai `using (true)`), jadi route ini aman diakses tanpa login — browser
// perlu bisa mengambil manifest ini bahkan sebelum kasir/admin login.
export async function GET() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("store_settings")
    .select("store_name, app_icon_url")
    .eq("id", 1)
    .single();

  const storeName = settings?.store_name || "Aplikasi Kasir";
  // Kalau admin belum upload ikon sendiri, pakai ikon bawaan aplikasi
  // (public/icons/icon-*.png) sebagai default — tidak pernah kosong.
  const icon192 = settings?.app_icon_url || "/icons/icon-192.png";
  const icon512 = settings?.app_icon_url || "/icons/icon-512.png";

  const manifest = {
    name: storeName,
    short_name: storeName.length > 12 ? storeName.slice(0, 12) : storeName,
    description: `Aplikasi POS kasir ${storeName}`,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#0f6d4f",
    orientation: "any",
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      // Cache pendek saja (bukan tanpa cache sama sekali) supaya kalau admin
      // baru ganti ikon, aplikasi/browser tidak perlu menunggu lama untuk
      // melihatnya, tapi tetap tidak membebani database di setiap load.
      "Cache-Control": "public, max-age=300, must-revalidate",
    },
  });
}
