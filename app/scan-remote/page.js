"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Bunyi "ti" pendek saat scan sukses, dibuat langsung lewat Web Audio API
// (tidak perlu file suara terpisah).
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1500;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch {
    // beberapa browser membatasi audio tanpa interaksi pengguna sebelumnya — abaikan jika gagal
  }
}

const COOLDOWN_MS = 3000; // jeda 3 detik sebelum bisa scan barcode berikutnya

function ScanRemoteInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");
  const [status, setStatus] = useState("connecting"); // connecting | subscribed | linked | error | camera_error | missing_id
  const [lastCode, setLastCode] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [cooldownActive, setCooldownActive] = useState(false);
  const channelRef = useRef(null);
  const scannerRef = useRef(null);
  const cooldownRef = useRef(false);
  const helloIntervalRef = useRef(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("missing_id");
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`scanner-pair-${sessionId}`, { config: { broadcast: { ack: true, self: false } } })
      .on("broadcast", { event: "ack" }, () => {
        setStatus("linked");
        clearInterval(helloIntervalRef.current);
      })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setStatus((s) => (s === "linked" ? s : "subscribed"));
          channel.send({ type: "broadcast", event: "hello", payload: {} });
          clearInterval(helloIntervalRef.current);
          let attempts = 0;
          helloIntervalRef.current = setInterval(() => {
            attempts += 1;
            if (attempts > 8) return clearInterval(helloIntervalRef.current);
            channel.send({ type: "broadcast", event: "hello", payload: {} });
          }, 1500);
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus("error");
        }
      });
    channelRef.current = channel;

    let html5Qrcode;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      html5Qrcode = new Html5Qrcode("phone-scan-region");
      scannerRef.current = html5Qrcode;
      html5Qrcode
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            if (cooldownRef.current) return;
            cooldownRef.current = true;
            setCooldownActive(true);
            setLastCode(decodedText);

            channelRef.current
              ?.send({ type: "broadcast", event: "scan", payload: { code: decodedText } })
              .then((res) => {
                if (res !== "ok") {
                  setSendError("Gagal mengirim ke layar utama. Pastikan halaman scanner masih terbuka di sana.");
                } else {
                  setSendError(null);
                  playBeep();
                  if (navigator.vibrate) navigator.vibrate(80);
                }
              })
              .catch(() => {
                setSendError("Gagal mengirim ke layar utama (koneksi terputus).");
              });

            setTimeout(() => {
              cooldownRef.current = false;
              setCooldownActive(false);
            }, COOLDOWN_MS);
          },
          () => {}
        )
        .catch(() => setStatus("camera_error"));
    });

    return () => {
      clearInterval(helloIntervalRef.current);
      if (scannerRef.current) scannerRef.current.stop().catch(() => {});
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const statusText = {
    connecting: "Menyambungkan ke server...",
    subscribed: "Mencari layar kasir...",
    linked: "Tersambung. Arahkan kamera ke barcode.",
    error: "Gagal tersambung ke server. Cek koneksi internet HP Anda.",
    camera_error: "Tidak bisa mengakses kamera. Izinkan akses kamera di browser.",
    missing_id: "Tautan tidak lengkap. Pindai ulang kode QR dari layar kasir.",
  }[status];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-lg font-semibold mb-1">Scanner HP</h1>
        <p className={`text-sm mb-4 ${status === "linked" ? "text-emerald-400" : "text-white/60"}`}>{statusText}</p>
        {status !== "missing_id" && <div id="phone-scan-region" className="rounded-xl overflow-hidden bg-white/5" />}
        {cooldownActive && (
          <div className="mt-3 text-xs text-amber-400">Jeda 3 detik sebelum bisa scan lagi...</div>
        )}
        {lastCode && (
          <div className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-sm">
            Terkirim: <span className="font-mono">{lastCode}</span>
          </div>
        )}
        {sendError && <p className="mt-2 text-xs text-red-400">{sendError}</p>}
        <p className="text-xs text-white/40 mt-6">
          Halaman ini tidak perlu login. Biarkan tetap terbuka selama ingin memakai HP sebagai scanner.
        </p>
      </div>
    </div>
  );
}

export default function ScanRemotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-sm text-white/60">Memuat...</p>
        </div>
      }
    >
      <ScanRemoteInner />
    </Suspense>
  );
}
