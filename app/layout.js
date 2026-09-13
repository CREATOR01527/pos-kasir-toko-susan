import "./globals.css";
import { Toaster } from "react-hot-toast";
import RegisterSW from "./RegisterSW";
import ScannerProvider from "@/components/ScannerProvider";
import GlobalScanToast from "@/components/GlobalScanToast";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("store_settings")
    .select("store_name, app_icon_url")
    .eq("id", 1)
    .single();

  const storeName = settings?.store_name || "Aplikasi Kasir";
  // Ikon aplikasi diatur admin di Pengaturan Toko; kalau belum diisi,
  // pakai ikon bawaan supaya tidak pernah kosong.
  const iconUrl = settings?.app_icon_url || "/icons/icon-192.png";
  const appleIconUrl = settings?.app_icon_url || "/icons/apple-touch-icon.png";

  return {
    title: storeName,
    description: `Aplikasi POS kasir ${storeName}`,
    manifest: "/manifest.json",
    icons: {
      icon: iconUrl,
      apple: appleIconUrl,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: storeName.length > 12 ? storeName.slice(0, 12) : storeName,
    },
  };
}

export const viewport = {
  themeColor: "#0f6d4f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full flex flex-col">
        <ScannerProvider>
          {children}
          <GlobalScanToast />
        </ScannerProvider>
        <Toaster position="top-center" toastOptions={{ duration: 2500 }} />
        <RegisterSW />
      </body>
    </html>
  );
}
