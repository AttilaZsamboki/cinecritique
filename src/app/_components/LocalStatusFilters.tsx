"use client";
import { useEffect, useMemo, useState } from "react";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export default function LocalStatusFilters({ gridId }: { gridId: string }) {
  const [watchOnly, setWatchOnly] = useState(false);
  const [seenOnly, setSeenOnly] = useState(false);

  useEffect(() => {
    const apply = () => {
      const grid = document.getElementById(gridId);
      if (!grid) return;
      const watch = readSet("cc_watchlist");
      const seen = readSet("cc_seen");
      const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-mid]"));
      for (const el of cards) {
        const mid = el.dataset.mid || "";
        const okWatch = !watchOnly || watch.has(mid);
        const okSeen = !seenOnly || seen.has(mid);
        el.style.display = okWatch && okSeen ? "" : "none";
      }
    };
    apply();
    const handler = () => apply();
    window.addEventListener("cc-storage-update", handler as any);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("cc-storage-update", handler as any);
      window.removeEventListener("storage", handler);
    };
  }, [gridId, watchOnly, seenOnly]);

  return (
    <div className="flex items-center gap-3 text-sm text-[#1b0e0e]">
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={watchOnly} onChange={e => setWatchOnly(e.target.checked)} />
        <span>Watchlist only</span>
      </label>
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={seenOnly} onChange={e => setSeenOnly(e.target.checked)} />
        <span>Seen only</span>
      </label>
    </div>
  );
}
