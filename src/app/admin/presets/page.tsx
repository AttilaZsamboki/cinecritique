"use client";

import { useEffect, useMemo, useState } from "react";

type Preset = {
  id: string;
  name: string | null;
  description: string | null;
  createdAt: string | null;
  weightsCount?: number;
};

export default function PresetsPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/presets", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load presets");
      setPresets(json.presets || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load presets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createPreset() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || undefined, description: description || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create preset");
      setName("");
      setDescription("");
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Failed to create preset");
    } finally {
      setCreating(false);
    }
  }

  async function applyPreset(presetId: string) {
    setApplying(presetId);
    setError(null);
    try {
      const res = await fetch("/api/presets/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to apply preset");
      // No further action; applied globally
    } catch (e: any) {
      setError(e?.message || "Failed to apply preset");
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="px-4 sm:px-8 lg:px-40 py-10">
      <h1 className="text-2xl font-semibold text-[#6b4a4c]">Criteria Presets</h1>

      <div className="mt-6 glass rounded-xl p-6 border border-white/40">
        <h2 className="text-lg font-medium text-[#6b4a4c]">Create new preset</h2>
        <p className="text-sm text-[#6b4a4c]/80 mt-1">Snapshot current criteria weights as a named preset.</p>
        <div className="mt-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col">
            <span className="text-xs text-[#6b4a4c]">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="glass rounded-md px-3 py-2 w-64" />
          </label>
          <label className="flex flex-col flex-1 min-w-[240px]">
            <span className="text-xs text-[#6b4a4c]">Description</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="glass rounded-md px-3 py-2" />
          </label>
          <button disabled={creating} onClick={createPreset} className="ml-auto glass rounded-md px-4 py-2 text-[#6b4a4c] hover:text-[#994d51] disabled:opacity-60">
            {creating ? "Creating..." : "Save preset"}
          </button>
        </div>
      </div>

      <div className="mt-6 glass rounded-xl p-6 border border-white/40">
        <h2 className="text-lg font-medium text-[#6b4a4c]">Existing presets</h2>
        {loading ? (
          <p className="text-sm text-[#6b4a4c]/80 mt-2">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        ) : presets.length === 0 ? (
          <p className="text-sm text-[#6b4a4c]/80 mt-2">No presets yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-white/40">
            {presets.map((p) => (
              <li key={p.id} className="py-3 flex items-center gap-3">
                <div>
                  <div className="text-[#6b4a4c] font-medium">{p.name || "(unnamed)"}</div>
                  <div className="text-xs text-[#6b4a4c]/80">{p.description || ""}</div>
                  {p.weightsCount !== undefined && (
                    <div className="text-xs text-[#6b4a4c]/70 mt-1">{p.weightsCount} weights</div>
                  )}
                </div>
                <div className="grow" />
                <button onClick={() => applyPreset(p.id)} disabled={applying === p.id} className="glass rounded-md px-3 py-1.5 text-sm text-[#6b4a4c] hover:text-[#994d51] disabled:opacity-60">
                  {applying === p.id ? "Applying…" : "Apply globally"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
