// Membuka laci kasir lewat printer thermal yang punya port RJ11 untuk laci
// (hampir semua printer struk thermal punya ini). Memakai Web Serial API bawaan
// Chrome/Edge — TIDAK perlu software tambahan, tapi HANYA berjalan di
// Chrome/Edge versi desktop (belum didukung di Safari/Firefox atau kebanyakan
// browser HP). Sekali izin port diberikan, browser akan mengingatnya.

const ESC_POS_KICK_DRAWER = new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]);

export function isDrawerSupported() {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

let cachedPort = null;

export async function openCashDrawer() {
  if (!isDrawerSupported()) {
    throw new Error(
      "Browser ini tidak mendukung buka laci otomatis (fitur hanya ada di Chrome/Edge di komputer/laptop). Gunakan tombol fisik di laci/printer."
    );
  }

  try {
    if (!cachedPort) {
      // Meminta pengguna memilih port printer sekali saja; setelahnya browser mengingat izinnya.
      cachedPort = await navigator.serial.requestPort();
      await cachedPort.open({ baudRate: 9600 });
    }
    const writer = cachedPort.writable.getWriter();
    await writer.write(ESC_POS_KICK_DRAWER);
    writer.releaseLock();
  } catch (err) {
    cachedPort = null;
    throw new Error("Gagal membuka laci: " + (err.message || "printer tidak terhubung"));
  }
}
