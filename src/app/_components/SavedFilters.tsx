"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type FiltersState = {
  search?: string;
  type?: string;
  yearFrom?: string;
  yearTo?: string;
  genre?: string;
  director?: string;
  actor?: string;
  writer?: string;
  minRating?: string;
  sort?: string;
};

const STORAGE_KEY = "cinecritique_saved_filters_v1";

type Preset = { name: string; params: FiltersState };

function toQS(params: FiltersState) {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.type) q.set("type", params.type);
  if (params.yearFrom) q.set("yearFrom", params.yearFrom);
  if (params.yearTo) q.set("yearTo", params.yearTo);
  if (params.genre) q.set("genre", params.genre);
  if (params.director) q.set("director", params.director);
  if (params.actor) q.set("actor", params.actor);
  if (params.writer) q.set("writer", params.writer);
  if (params.minRating) q.set("minRating", params.minRating);
  if (params.sort) q.set("sort", params.sort);
  return q.toString();
}

export default function SavedFilters({ current }: { current: FiltersState }) {
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPresets(JSON.parse(raw));
    } catch {}
  }, []);

  const savePresets = (next: Preset[]) => {
    setPresets(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };

  const [name, setName] = useState("");

  const currentQS = useMemo(() => toQS(current), [current]);

  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Preset name"
        className="h-9 rounded-xl border border-white/30 bg-white/60 px-3 text-sm text-[#1b0e0e] placeholder:text-[#6b4a4c]/60"
      />
      <button
        className="h-9 rounded-xl px-3 text-sm bg-[#994d51] text-white shadow-sm hover:bg-[#7a3d41]"
        onClick={() => {
          const trimmed = name.trim();
          if (!trimmed) return;
          const idx = presets.findIndex(p => p.name.toLowerCase() === trimmed.toLowerCase());
          const next: Preset[] = idx >= 0
            ? presets.map((p,i) => i===idx ? { name: trimmed, params: current } : p)
            : [...presets, { name: trimmed, params: current }];
          savePresets(next);
          setName("");
        }}
        title="Save current filters"
      >Save</button>
      <div className="relative">
        <select
          className="h-9 rounded-xl border border-white/30 bg-white/60 px-3 text-sm text-[#1b0e0e]"
          defaultValue=""
          onChange={(e) => {
            const val = e.currentTarget.value;
            if (!val) return;
            const p = presets.find(pr => pr.name === val);
            if (!p) return;
            // navigate by link programmatically not necessary; we render Link below
            window.location.href = `/?${toQS(p.params)}`;
          }}
        >
          <option value="">Load preset…</option>
          {presets.map(p => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      </div>
      {currentQS && (
        <Link
          href={`/?${currentQS}`}
          className="h-9 inline-flex items-center rounded-xl px-3 text-sm bg-white/60 text-[#994d51] border border-[#994d51]/30 shadow-sm hover:bg-white"
          title="Copy/share current filters"
        >Share</Link>
      )}
    </div>
  );
}
