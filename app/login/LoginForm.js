"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import InstallAppButton from "@/components/InstallAppButton";
import { googleFontHref } from "@/lib/loginFonts";

export default function LoginForm({ settings }) {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const s = settings || {};
  const bgType = s.login_bg_type || "color";
  const fontFamily = s.login_font_family || "Inter";

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // username disimpan di profiles, login Supabase pakai email -> konversi username jadi email internal
      const email = username.includes("@") ? username : `${username.trim().toLowerCase()}@kasir.local`;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (!profile || !profile.active) {
        await supabase.auth.signOut();
        throw new Error("Akun tidak aktif atau tidak ditemukan.");
      }

      toast.success(`Selamat datang, ${profile.full_name}`);
      router.push(profile.role === "admin" ? "/admin/dashboard" : "/kasir");
      router.refresh();
    } catch (err) {
      toast.error(err.message || "Username atau password salah.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex-1 flex items-center justify-center p-6 overflow-hidden bg-black">
      {/* Memuat font pilihan admin langsung dari Google Fonts di browser (tidak berat saat build) */}
      <link rel="stylesheet" href={googleFontHref(fontFamily)} />

      {/* ---------- Lapisan Latar Belakang ---------- */}
      {bgType === "video" && s.login_bg_video_url && (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={s.login_bg_video_url}
          autoPlay
          loop
          muted
          playsInline
        />
      )}
      {bgType === "image" && s.login_bg_url && (
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center"
          style={{ backgroundImage: `url(${s.login_bg_url})` }}
        />
      )}
      {bgType === "color" && (
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            background: `linear-gradient(135deg, ${s.login_gradient_from || "#0f6d4f"}, ${s.login_gradient_to || "#0b1f19"})`,
          }}
        />
      )}
      {/* Overlay gelap tipis supaya form tetap terbaca di atas background apa pun */}
      <div className="absolute inset-0 bg-black/40" />

      {/* ---------- Kartu Form Login ---------- */}
      <div className="relative w-full max-w-sm bg-surface/95 backdrop-blur border border-border rounded-2xl shadow-xl p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-11 w-11 rounded-xl bg-primary-soft flex items-center justify-center text-primary font-semibold text-lg">
            {(s.store_name || "K").charAt(0).toUpperCase()}
          </div>
          <h1
            style={{
              color: s.login_font_color || "var(--ink)",
              fontFamily: `"${fontFamily}", sans-serif`,
              fontWeight: s.login_font_weight || 600,
            }}
            className="text-xl"
          >
            {s.login_title || "Masuk ke Aplikasi Kasir"}
          </h1>
          <p className="text-sm text-ink-muted mt-1">{s.store_name || "Toko Saya"}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Username</label>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="mis. siti"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ background: s.login_accent_color || "var(--primary)" }}
            className="w-full text-white rounded-lg py-2.5 text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
        <InstallAppButton />
      </div>
    </div>
  );
}
