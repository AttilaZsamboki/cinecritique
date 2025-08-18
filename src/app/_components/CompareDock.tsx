"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

function readSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export default function CompareDock() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const update = () => setIds(Array.from(readSet("cc_compare")));
    update();
    const handler = () => update();
    window.addEventListener("cc-storage-update", handler as any);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("cc-storage-update", handler as any);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const compareHref = useMemo(() => {
    if (ids.length === 0) return "#";
    const q = new URLSearchParams();
    q.set("ids", ids.join(","));
    return `/compare?${q.toString()}`;
  }, [ids]);

  if (ids.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="glass-strong rounded-full border border-white/40 shadow-elegant flex items-center gap-3 px-4 py-2">
        <div className="text-sm font-semibold text-[#1b0e0e]">
          Compare: {ids.length}
        </div>
        <Link
          href={compareHref}
          className="rounded-full bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white text-sm font-bold px-3 py-1.5"
          prefetch={false}
        >Open</Link>
      </div>
    </div>
  );
}
