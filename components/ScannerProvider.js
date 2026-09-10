"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ScannerContext = createContext(null);

export function useScanner() {
  const ctx = useContext(ScannerContext);
  if (!ctx) throw new Error("useScanner harus dipakai di dalam ScannerProvider");
  return ctx;
}

// Event global yang dipancarkan setiap kali ada barcode terdeteksi,
// baik dari scanner fisik (keyboard wedge) maupun dari HP yang disambungkan via QR.
// Halaman mana pun bisa `window.addEventListener("pos-barcode-scan", handler)`.
export const BARCODE_EVENT = "pos-barcode-scan";

function emitScan(code, source) {
  window.dispatchEvent(new CustomEvent(BARCODE_EVENT, { detail: { code, source } }));
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ScannerProvider({ children }) {
  const supabaseRef = useRef(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);
  const [physicalActive, setPhysicalActive] = useState(false);
  const [phoneSession, setPhoneSession] = useState(null); // { id, connected, error }
  const [lastScan, setLastScan] = useState(null); // { code, source, at } — untuk diagnosa
  const bufferRef = useRef("");
  const timerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const channelRef = useRef(null);
  const sessionIdRef = useRef(null);

  // ---------- Deteksi scanner fisik (keyboard wedge) di SELURUH halaman ----------
  useEffect(() => {
    function onKeydown(e) {
      const tag = document.activeElement?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";

      if (/^[a-zA-Z0-9]$/.test(e.key)) {
        bufferRef.current += e.key;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, 60);
      } else if (e.key === "Enter" && bufferRef.current.length >= 4) {
        const code = bufferRef.current;
        bufferRef.current = "";
        if (!isTyping) {
          setPhysicalActive(true);
          clearTimeout(idleTimerRef.current);
          idleTimerRef.current = setTimeout(() => setPhysicalActive(false), 60000);
          setLastScan({ code, source: "physical", at: Date.now() });
          emitScan(code, "physical");
        }
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
      clearTimeout(timerRef.current);
      clearTimeout(idleTimerRef.current);
    };
  }, []);

  // ---------- Sambungkan HP via QR (Supabase Realtime broadcast) ----------
  const openChannel = useCallback(
    (id) => {
      const supabase = getSupabase();
      const channel = supabase
        .channel(`scanner-pair-${id}`, { config: { broadcast: { ack: true, self: false } } })
        .on("broadcast", { event: "scan" }, (payload) => {
          const code = payload?.payload?.code;
          if (!code) return;
          setLastScan({ code, source: "phone", at: Date.now() });
          emitScan(code, "phone");
        })
        .on("broadcast", { event: "hello" }, () => {
          setPhoneSession((s) => (s ? { ...s, connected: true, error: null } : s));
          channel.send({ type: "broadcast", event: "ack", payload: {} });
        })
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setPhoneSession((s) => (s ? { ...s, connected: false, error: "Koneksi realtime putus. Mencoba menyambung ulang..." } : s));
          } else if (status === "CLOSED") {
            // HP yang layarnya redup/terkunci bisa memutus koneksi diam-diam.
            // Coba sambung ulang otomatis di channel yang sama selama sesi masih aktif.
            if (sessionIdRef.current === id) {
              setTimeout(() => {
                if (sessionIdRef.current === id) {
                  channelRef.current = openChannel(id);
                }
              }, 1500);
            }
          } else if (status === "SUBSCRIBED") {
            setPhoneSession((s) => (s ? { ...s, error: null } : s));
          }
        });
      return channel;
    },
    [getSupabase]
  );

  const startPairing = useCallback(() => {
    const id = makeId();
    sessionIdRef.current = id;
    channelRef.current = openChannel(id);
    setPhoneSession({ id, connected: false, error: null });
    return id;
  }, [openChannel]);

  const stopPairing = useCallback(() => {
    sessionIdRef.current = null;
    if (channelRef.current) getSupabase().removeChannel(channelRef.current);
    channelRef.current = null;
    setPhoneSession(null);
  }, [getSupabase]);

  useEffect(() => {
    return () => {
      sessionIdRef.current = null;
      if (channelRef.current) getSupabase().removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScannerContext.Provider
      value={{
        physicalActive,
        phoneConnected: !!phoneSession?.connected,
        phoneSessionId: phoneSession?.id || null,
        phoneError: phoneSession?.error || null,
        lastScan,
        startPairing,
        stopPairing,
      }}
    >
      {children}
    </ScannerContext.Provider>
  );
}
