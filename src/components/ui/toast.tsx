"use client";
import React, { useEffect, useState } from "react";

export type ToastKind = "success" | "error" | "info";
export type ToastEventDetail = { id?: number; message: string; kind?: ToastKind; durationMs?: number };

const TOAST_EVENT = "cinecritique:toast";

export function toast(detail: ToastEventDetail | string) {
  const payload: ToastEventDetail = typeof detail === "string" ? { message: detail } : detail;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}

export function Toaster() {
  const [items, setItems] = useState<Array<Required<ToastEventDetail>>>([]);
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<ToastEventDetail>;
      const id = Date.now() + Math.random();
      const entry: Required<ToastEventDetail> = {
        id,
        message: ev.detail.message,
        kind: ev.detail.kind ?? "info",
        durationMs: ev.detail.durationMs ?? 2200,
      };
      setItems(prev => [...prev, entry]);
      const t = setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== id));
      }, entry.durationMs);
    };
    window.addEventListener(TOAST_EVENT, handler as EventListener);
    return () => window.removeEventListener(TOAST_EVENT, handler as EventListener);
  }, []);

  return (
    <div className="fixed z-[1000] bottom-4 right-4 flex flex-col gap-2">
      {Array.isArray(items) && items.map((i) => (
        <div key={i.id} className={`rounded-xl px-3 py-2 shadow-lg border text-sm backdrop-blur-sm ${
          i.kind === "success" ? "bg-emerald-50/90 border-emerald-200 text-emerald-900" :
          i.kind === "error" ? "bg-rose-50/90 border-rose-200 text-rose-900" :
          "bg-white/90 border-[#e7d0d1] text-[#1b0e0e]"
        }`}>
          {i.message}
        </div>
      ))}
    </div>
  );
}
