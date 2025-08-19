"use client";

import { useEffect, useMemo, useState } from "react";

type PresetListItem = { id: string; name: string | null; description: string | null };

type PresetWeights = {
  id: string;
  name: string | null;
  description: string | null;
  weights: { criteriaId: string | null; criteriaName: string | null; parentId: string | null; weight: number | null }[];
};

export default function PresetCompare() {
  const [allPresets, setAllPresets] = useState<PresetListItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [data, setData] = useState<PresetWeights[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/presets", { cache: "no-store" });
        const json = await res.json();
        setAllPresets(json.presets || []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function load() {
    if (!selected.length) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/presets/weights?ids=${encodeURIComponent(selected.join(","))}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load weights");
      setData(json.presets as PresetWeights[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load weights");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    if (!data || data.length < 2) return [] as { name: string; values: (number | null)[] }[];
    const byCrit = new Map<string, { name: string; values: (number | null)[] }>();
    data.forEach((preset, idx) => {
      preset.weights.forEach((w) => {
        const key = w.criteriaId ?? `null-${w.criteriaName}`;
        if (!byCrit.has(key)) byCrit.set(key, { name: w.criteriaName ?? "(unnamed)", values: Array(data.length).fill(null) });
        byCrit.get(key)!.values[idx] = w.weight ?? null;
      });
    });
    return Array.from(byCrit.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col">
          <span className="text-xs text-[#6b4a4c]">Select presets (2-4)</span>
          <select
            multiple
            size={Math.min(6, Math.max(3, allPresets.length))}
            value={selected}
            onChange={(e) => setSelected(Array.from(e.currentTarget.selectedOptions).map((o) => o.value))}
            className="glass rounded-md px-3 py-2 min-w-64"
            aria-label="Select presets to compare"
          >
            {allPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "(unnamed)"}
              </option>
            ))}
          </select>
        </label>
        <button
          className="glass rounded-md px-4 py-2 text-[#6b4a4c] hover:text-[#994d51] disabled:opacity-60"
          onClick={load}
          disabled={loading || selected.length < 2 || selected.length > 4}
        >
          {loading ? "Loading…" : "Compare"}
        </button>
        {error && <div role="status" className="text-sm text-red-600">{error}</div>}
      </div>

      {data && data.length >= 2 && (
        <div className="overflow-x-auto mt-4">
          <table className="min-w-full text-xs text-left">
            <thead>
              <tr className="text-[#6b4a4c]">
                <th className="py-2 pr-3">Criteria</th>
                {data.map((p) => (
                  <th key={p.id} className="py-2 px-3 whitespace-nowrap">{p.name || p.id.slice(0, 6)}</th>
                ))}
                <th className="py-2 px-3">Δ (max - min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {rows.map((r, i) => {
                const nums = r.values.filter((v): v is number => typeof v === 'number');
                const max = nums.length ? Math.max(...nums) : null;
                const min = nums.length ? Math.min(...nums) : null;
                const delta = max !== null && min !== null ? max - min : null;
                return (
                  <tr key={i}>
                    <td className="py-2 pr-3 text-[#1b0e0e]">{r.name}</td>
                    {r.values.map((v, j) => (
                      <td key={j} className="py-2 px-3 tabular-nums">
                        {v === null ? <span className="text-[#6b4a4c]">–</span> : v}
                      </td>
                    ))}
                    <td className="py-2 px-3 tabular-nums">{delta === null ? <span className="text-[#6b4a4c]">–</span> : delta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
