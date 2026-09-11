"use client";

import { useEffect, useState } from "react";

// Deteksi jenis perangkat dari lebar layar, dipakai untuk menyesuaikan
// tampilan Kasir & Admin: HP (mobile), Tablet, atau Desktop/Laptop.
// Batasnya sengaja disamakan dengan breakpoint umum: <768px = HP,
// 768-1099px = Tablet, >=1100px = Desktop.
export function useViewport() {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  useEffect(() => {
    function onResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1100;
  const isDesktop = width >= 1100;

  return { width, isMobile, isTablet, isDesktop };
}
