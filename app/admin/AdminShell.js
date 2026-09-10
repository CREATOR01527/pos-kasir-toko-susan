"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  Undo2,
  Clock,
  Package,
  Boxes,
  Tags,
  Truck,
  ShoppingCart,
  Users,
  ScrollText,
  UserCog,
  Archive,
  ShoppingBag,
  Settings,
  Keyboard,
  LogOut,
  Bell,
  Moon,
  Sun,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ScannerStatusWidget from "@/components/ScannerStatusWidget";
import toast from "react-hot-toast";
import { formatRupiah } from "@/lib/format";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/kasir", label: "Buka Kasir", icon: ShoppingBag },
  { href: "/admin/kasir-shortcut", label: "Shortcut Kasir", icon: Keyboard },
  { href: "/admin/kasbon", label: "Kasbon Pelanggan", icon: Wallet },
  { href: "/admin/retur", label: "Retur Barang", icon: Undo2 },
  { href: "/admin/shift-kas", label: "Shift & Kas", icon: Clock },
  { href: "/admin/produk", label: "Produk & Harga", icon: Package },
  { href: "/admin/stok", label: "Stok & Barang Masuk", icon: Boxes },
  { href: "/admin/label-barcode", label: "Label & Barcode", icon: Tags },
  { href: "/admin/supplier", label: "Supplier", icon: Truck },
  { href: "/admin/pembelian", label: "Pembelian", icon: ShoppingCart },
  { href: "/admin/pelanggan", label: "Pelanggan", icon: Users },
  { href: "/admin/log-aktivitas", label: "Log Aktivitas", icon: ScrollText },
  { href: "/admin/arsip", label: "Arsip Data", icon: Archive },
  { href: "/admin/pengguna", label: "Pengguna", icon: UserCog },
  { href: "/admin/pengaturan", label: "Pengaturan Toko", icon: Settings },
];

export default function AdminShell({ profile, settings, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [dark, setDark] = useState(settings?.theme === "dark");
  const [lowStockCount, setLowStockCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    async function loadLowStock() {
      const { data } = await supabase
        .from("products")
        .select("id, name, stock_qty, min_stock")
        .eq("active", true);
      const low = (data || []).filter((p) => Number(p.stock_qty) <= Number(p.min_stock));
      setLowStockItems(low);
      setLowStockCount(low.length);
    }
    loadLowStock();

    const channel = supabase
      .channel("admin-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, loadLowStock)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" }, (payload) => {
        const tx = payload.new;
        if (tx?.status === "completed") {
          toast.success(`Transaksi baru: ${formatRupiah(tx.total)}`, { icon: "🧾" });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-1 h-screen overflow-hidden">
      <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <p className="text-sm font-semibold truncate">{settings?.store_name || "Toko Saya"}</p>
          <p className="text-xs text-ink-muted">Panel Admin</p>
        </div>
        <nav className="flex-1 overflow-auto p-2 space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-primary-soft text-primary font-medium" : "text-ink-muted hover:bg-background hover:text-ink"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft">
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-end gap-2 px-5">
          <ScannerStatusWidget />
          <div className="relative">
            <button onClick={() => setNotifOpen((v) => !v)} className="relative p-2 rounded-lg hover:bg-background">
              <Bell size={18} />
              {lowStockCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-danger text-white text-[10px] flex items-center justify-center">
                  {lowStockCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-xl shadow-lg p-3 z-20">
                <p className="text-xs font-medium mb-2">Stok Menipis</p>
                {lowStockItems.length === 0 && <p className="text-xs text-ink-muted">Semua stok aman.</p>}
                <div className="space-y-1 max-h-64 overflow-auto">
                  {lowStockItems.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs py-1">
                      <span className="truncate">{p.name}</span>
                      <span className="text-danger font-medium">{p.stock_qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setDark((v) => !v)} className="p-2 rounded-lg hover:bg-background">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="pl-2 ml-1 border-l border-border text-sm">
            <p className="font-medium leading-tight">{profile.full_name}</p>
            <p className="text-xs text-ink-muted leading-tight">Admin</p>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
