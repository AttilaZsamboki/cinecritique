"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [limit, setLimit] = useState(50);
  const [missingOnly, setMissingOnly] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | { scanned: number; updated: number; errors: { id: string; reason: string }[] }>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSync() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/omdb-sync?limit=${limit}&missingOnly=${missingOnly}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setResult(json);
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="px-4 sm:px-8 lg:px-40 py-10">
      <h1 className="text-2xl font-semibold text-[#6b4a4c]">Admin</h1>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="glass rounded-xl p-6 border border-white/40">
          <h2 className="text-lg font-medium text-[#6b4a4c]">OMDb Enrichment</h2>
          <p className="text-sm text-[#6b4a4c]/80 mt-1">One-click sync for missing metadata/posters.</p>

          <div className="mt-4 flex gap-3 items-end">
            <label className="flex flex-col">
              <span className="text-xs text-[#6b4a4c]">Limit</span>
              <input type="number" value={limit} min={1} max={500} onChange={(e) => setLimit(parseInt(e.target.value || "0") || 1)} className="glass rounded-md px-3 py-2 w-28" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
              <span className="text-sm text-[#6b4a4c]">Only missing fields</span>
            </label>
            <button disabled={running} onClick={runSync} className="ml-auto glass rounded-md px-4 py-2 text-[#6b4a4c] hover:text-[#994d51] disabled:opacity-60">
              {running ? "Running..." : "Sync metadata/poster"}
            </button>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          {result && (
            <div className="text-sm text-[#6b4a4c] mt-3">
              <div>Scanned: {result.scanned}</div>
              <div>Updated: {result.updated}</div>
              {result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer">Errors ({result.errors.length})</summary>
                  <ul className="list-disc pl-5">
                    {result.errors.slice(0, 50).map((e, i) => (
                      <li key={i} className="truncate">{e.id}: {e.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="glass rounded-xl p-6 border border-white/40">
          <h2 className="text-lg font-medium text-[#6b4a4c]">Criteria Presets</h2>
          <p className="text-sm text-[#6b4a4c]/80 mt-1">Save/load named scoring weight sets and apply globally.</p>
          <Link href="/admin/presets" className="inline-block mt-4 glass rounded-md px-4 py-2 text-[#6b4a4c] hover:text-[#994d51]">Manage presets →</Link>
        </div>
      </div>
    </div>
  );
}
