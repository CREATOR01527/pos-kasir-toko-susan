import "./globals.css";
import { Toaster } from "react-hot-toast";
import RegisterSW from "./RegisterSW";
import ScannerProvider from "@/components/ScannerProvider";
import GlobalScanToast from "@/components/GlobalScanToast";

export const metadata = {
  title: "Aplikasi Kasir",
  description: "Aplikasi POS kasir toko",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kasir",
  },
};

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
