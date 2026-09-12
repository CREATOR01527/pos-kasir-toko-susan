// Kirim pesan teks lewat Telegram Bot API. Dipakai untuk notifikasi stok
// menipis & laporan harian (lihat app/api/notify/*). Telegram dipilih
// (bukan WhatsApp API) karena bot-nya gratis dan tidak perlu verifikasi
// bisnis — admin cukup isi Bot Token & Chat ID di halaman Pengaturan.
export async function sendTelegramMessage(botToken, chatId, text) {
  if (!botToken || !chatId) {
    throw new Error("Bot Token / Chat ID Telegram belum diisi di Pengaturan");
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(data?.description || "Gagal mengirim pesan Telegram — cek kembali Bot Token & Chat ID");
  }
  return data;
}
