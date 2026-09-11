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

// Bunyi "tit" pendek saat kamera HP berhasil memindai barcode -- dibuat langsung
// pakai Web Audio API (nada pendek), jadi tidak perlu file suara terpisah dan
// tetap jalan walau aplikasi sedang offline/di-install sebagai PWA.
export function playScanBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 1500;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15);
    oscillator.onended = () => ctx.close().catch(() => {});
  } catch {
    // beberapa browser (mis. autoplay policy ketat) bisa gagal, biarkan diam-diam
  }
}
