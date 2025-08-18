"use client";
import { useEffect, useState } from "react";
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

function writeSet(key: string, set: Set<string>) {
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

export default function CardActions({ movieId }: { movieId: string }) {
  const [watchlist, setWatchlist] = useState(false);
  const [seen, setSeen] = useState(false);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    const wl = readSet("cc_watchlist");
    const sn = readSet("cc_seen");
    const cp = readSet("cc_compare");
    setWatchlist(wl.has(movieId));
    setSeen(sn.has(movieId));
    setPicked(cp.has(movieId));
  }, [movieId]);

  const toggle = (key: string, setter: (v: boolean) => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const set = readSet(key);
    if (set.has(movieId)) set.delete(movieId); else set.add(movieId);
    writeSet(key, set);
    setter(set.has(movieId));
    // Broadcast an update so other components can react (e.g., CompareDock)
    window.dispatchEvent(new CustomEvent("cc-storage-update", { detail: { key } }));
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={toggle("cc_watchlist", setWatchlist)}
        className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${watchlist ? "bg-[#994d51] text-white border-[#994d51]" : "bg-white/80 text-[#1b0e0e] border-white/60"}`}
        title={watchlist ? "Remove from watchlist" : "Add to watchlist"}
      >WL</button>
      <button
        type="button"
        onClick={toggle("cc_seen", setSeen)}
        className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${seen ? "bg-[#7a3d41] text-white border-[#7a3d41]" : "bg-white/80 text-[#1b0e0e] border-white/60"}`}
        title={seen ? "Mark as unseen" : "Mark as seen"}
      >Seen</button>
      <button
        type="button"
        onClick={toggle("cc_compare", setPicked)}
        className={`px-2 py-1 rounded-full text-[10px] font-semibold border transition-colors ${picked ? "bg-[#1b0e0e] text-white border-[#1b0e0e]" : "bg-white/80 text-[#1b0e0e] border-white/60"}`}
        title={picked ? "Remove from compare" : "Add to compare"}
      >Cmp</button>
    </div>
  );
}
