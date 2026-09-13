"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_MAX_SIZE_MB = 5;

// Upload gambar ke bucket Supabase Storage "toko-images" (lihat
// migration-13-upload-gambar.sql), lalu mengembalikan URL publiknya lewat
// onChange — dipakai persis seperti field URL biasa, cuma sekarang admin
// bisa langsung pilih file dari HP/laptop, bukan cuma tempel link.
export default function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  folder = "misc",
  accept = "image/*",
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  isVideo = false,
  className = "",
}) {
  const supabase = createClient();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // supaya bisa pilih file yang sama lagi kalau perlu
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`Ukuran file maksimal ${maxSizeMB}MB`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("toko-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("toko-images").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Gambar berhasil diunggah");
    } catch (err) {
      toast.error(
        err.message?.includes("Bucket not found")
          ? "Bucket penyimpanan belum dibuat — jalankan migration-13-upload-gambar.sql di Supabase dulu"
          : err.message || "Gagal mengunggah gambar"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium mb-1.5">{label}</label>}
      <div className="flex items-center gap-3">
        {value ? (
          isVideo ? (
            <video src={value} className="w-16 h-16 object-cover rounded-lg border border-border bg-background shrink-0" muted />
          ) : (
            <img src={value} alt="" className="w-16 h-16 object-contain rounded-lg border border-border bg-background shrink-0" />
          )
        ) : (
          <div className="w-16 h-16 rounded-lg border border-dashed border-border shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-background disabled:opacity-50"
            >
              {uploading ? "Mengunggah..." : value ? "Ganti Gambar" : "Upload Gambar"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft"
              >
                Hapus
              </button>
            )}
          </div>
          <input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="atau tempel link gambar (URL) di sini"
            className="w-full mt-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="hidden" />
      {hint && <p className="text-xs text-ink-muted mt-1.5">{hint}</p>}
    </div>
  );
}
