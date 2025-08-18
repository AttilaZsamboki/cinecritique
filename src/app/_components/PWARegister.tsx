"use client";
import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // Optional: listen for updates
        if (reg && reg.installing) {
          reg.installing.addEventListener("statechange", () => {
            // no-op
          });
        }
      } catch (e) {
        // silently ignore
      }
    };
    register();
  }, []);
  return null;
}
