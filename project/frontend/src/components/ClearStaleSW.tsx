"use client";

import { useEffect } from "react";

/** Unregister leftover service workers from other localhost:3000 apps. */
export function ClearStaleSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    }
  }, []);
  return null;
}
