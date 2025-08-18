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
    <div
      className="fixed z-[1000] bottom-4 right-4 flex flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      {Array.isArray(items) && items.map((i) => (
        <div
          key={i.id}
          role="status"
          className={
            `group rounded-xl px-3 py-2 shadow-lg border text-sm backdrop-blur-sm flex items-start gap-3 max-w-[360px] ` +
            (i.kind === "success"
              ? "bg-emerald-50/90 border-emerald-200 text-emerald-900 dark:bg-emerald-900/40 dark:border-emerald-800 dark:text-emerald-50"
              : i.kind === "error"
              ? "bg-rose-50/90 border-rose-200 text-rose-900 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-50"
              : "bg-white/90 border-[#e7d0d1] text-[#1b0e0e] dark:bg-zinc-900/70 dark:border-zinc-800 dark:text-zinc-50")
          }
        >
          <span className="pt-0.5">{i.message}</span>
          <button
            onClick={() => setItems(prev => prev.filter(x => x.id !== i.id))}
            aria-label="Dismiss notification"
            className="ml-auto opacity-70 hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded-md bg-white/40 dark:bg-zinc-800/60 border border-white/30 dark:border-zinc-700"
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}
