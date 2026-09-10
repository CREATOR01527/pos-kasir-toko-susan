"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Select, Textarea } from "@/components/ui/kit";
import { LOGIN_FONTS, LOGIN_FONT_WEIGHTS } from "@/lib/loginFonts";

export default function PengaturanPage() {
  const supabase = createClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase.from("store_settings").select("*").eq("id", 1).single();
    setForm(data);
  }

  async function save() {
    setSaving(true);
    try {
      const { id, updated_at, ...payload } = form;
      const { error } = await supabase.from("store_settings").update(payload).eq("id", 1);
      if (error) throw error;
      toast.success("Pengaturan disimpan");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p className="text-sm text-ink-muted">Memuat...</p>;

  const bgType = form.login_bg_type || "color";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan Toko</h1>
        <p className="text-sm text-ink-muted">Identitas toko untuk struk, modal awal laci, tema aplikasi, tampilan halaman login, dan info pembayaran.</p>
      </div>

      <Card title="Identitas Toko">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Nama Toko" value={form.store_name || ""} onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
          <Input label="Telepon Toko" value={form.store_phone || ""} onChange={(e) => setForm({ ...form, store_phone: e.target.value })} />
        </div>
        <Textarea label="Alamat Toko" value={form.store_address || ""} onChange={(e) => setForm({ ...form, store_address: e.target.value })} rows={2} className="mt-3" />
        <Textarea label="Catatan Kaki Struk" value={form.receipt_footer || ""} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} rows={2} className="mt-3" />
      </Card>

      <Card title="Info Pembayaran (Transfer & QRIS Manual)">
        <p className="text-xs text-ink-muted mb-3">
          Ditampilkan ke kasir saat memilih metode Transfer atau QRIS di layar pembayaran,
          supaya kasir bisa memberi tahu nomor rekening / menunjukkan QRIS ke pembeli.
        </p>
        <Textarea
          label="Info Rekening Transfer"
          placeholder={"BCA 1234567890 a.n. Toko Susan"}
          value={form.bank_transfer_info || ""}
          onChange={(e) => setForm({ ...form, bank_transfer_info: e.target.value })}
          rows={2}
        />
        <Input
          label="URL Gambar QRIS (opsional)"
          placeholder="https://..."
          value={form.qris_image_url || ""}
          onChange={(e) => setForm({ ...form, qris_image_url: e.target.value })}
          className="mt-3"
          hint="Unggah gambar QRIS toko Anda ke penyimpanan gambar mana saja, lalu tempel link-nya di sini."
        />
      </Card>

      <Card title="Tema Aplikasi">
        <Select label="Mode Tampilan Default" value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} className="max-w-xs">
          <option value="light">Terang</option>
          <option value="dark">Gelap</option>
        </Select>
      </Card>

      <Card title="Tampilan Halaman Login">
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <Input label="Judul Halaman Login" value={form.login_title || ""} onChange={(e) => setForm({ ...form, login_title: e.target.value })} />
          <Select label="Pilihan Font" value={form.login_font_family || "Inter"} onChange={(e) => setForm({ ...form, login_font_family: e.target.value })}>
            {LOGIN_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
          <Select label="Ketebalan Font" value={form.login_font_weight || "600"} onChange={(e) => setForm({ ...form, login_font_weight: e.target.value })}>
            {LOGIN_FONT_WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </Select>
          <div>
            <label className="block text-sm font-medium mb-1.5">Warna Judul</label>
            <input type="color" value={form.login_font_color || "#111827"} onChange={(e) => setForm({ ...form, login_font_color: e.target.value })} className="h-10 w-full rounded-lg border border-border" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Warna Aksen Tombol</label>
            <input type="color" value={form.login_accent_color || "#2563eb"} onChange={(e) => setForm({ ...form, login_accent_color: e.target.value })} className="h-10 w-full rounded-lg border border-border" />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <Select label="Tipe Latar Belakang" value={bgType} onChange={(e) => setForm({ ...form, login_bg_type: e.target.value })} className="max-w-xs mb-3">
            <option value="color">Warna Gradasi Polos</option>
            <option value="image">Gambar (bisa GIF animasi)</option>
            <option value="video">Video (bergerak, paling "hidup")</option>
          </Select>

          {bgType === "color" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Warna Gradasi Awal</label>
                <input type="color" value={form.login_gradient_from || "#0f6d4f"} onChange={(e) => setForm({ ...form, login_gradient_from: e.target.value })} className="h-10 w-full rounded-lg border border-border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Warna Gradasi Akhir</label>
                <input type="color" value={form.login_gradient_to || "#0b1f19"} onChange={(e) => setForm({ ...form, login_gradient_to: e.target.value })} className="h-10 w-full rounded-lg border border-border" />
              </div>
            </div>
          )}

          {bgType === "image" && (
            <Input
              label="URL Gambar Latar (mendukung GIF animasi)"
              placeholder="https://... (bisa file .jpg, .png, atau .gif)"
              value={form.login_bg_url || ""}
              onChange={(e) => setForm({ ...form, login_bg_url: e.target.value })}
            />
          )}

          {bgType === "video" && (
            <Input
              label="URL Video Latar (.mp4)"
              placeholder="https://.../latar.mp4"
              value={form.login_bg_video_url || ""}
              onChange={(e) => setForm({ ...form, login_bg_video_url: e.target.value })}
              hint="Video akan diputar otomatis, diulang terus, dan tanpa suara — supaya halaman login terasa hidup."
            />
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
      </div>
    </div>
  );
}
