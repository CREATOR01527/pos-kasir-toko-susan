// Mengucapkan nama barang memakai Web Speech API bawaan browser (gratis, tanpa API luar).
// Pengaturan aktif/nonaktif disimpan per-perangkat di localStorage (bukan pengaturan toko),
// karena suara ini soal perangkat kasir yang dipakai, bukan konfigurasi bisnis.

const STORAGE_KEY = "kasir_voice_enabled";

export function isVoiceEnabled() {
  if (typeof window === "undefined") return true;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "1";
}

export function setVoiceEnabled(enabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

export function speakProductName(name) {
  if (typeof window === "undefined") return;
  if (!isVoiceEnabled()) return;
  if (!("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel(); // hentikan ucapan sebelumnya biar tidak menumpuk
    const utter = new SpeechSynthesisUtterance(name);
    utter.lang = "id-ID";
    utter.rate = 1.05;
    utter.pitch = 1;
    window.speechSynthesis.speak(utter);
  } catch {
    // beberapa browser lama tidak mendukung, gagal secara diam-diam
  }
}
