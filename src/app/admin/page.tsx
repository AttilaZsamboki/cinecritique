"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [limit, setLimit] = useState(50);
  const [missingOnly, setMissingOnly] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | { scanned: number; updated: number; errors: { id: string; reason: string }[] }>(null);
  const [error, setError] = useState<string | null>(null);
  // Manual import state
  const [omdbTitle, setOmdbTitle] = useState("");
  const [omdbYear, setOmdbYear] = useState<string>("");
  const [omdbImdbId, setOmdbImdbId] = useState("");
  const [tmdbTitle, setTmdbTitle] = useState("");
  const [tmdbYear, setTmdbYear] = useState<string>("");
  const [tmdbId, setTmdbId] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

  async function runOmdbImportByTitle() {
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/import/omdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "title", title: omdbTitle.trim(), year: omdbYear ? Number(omdbYear) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setImportResult(json.movie);
    } catch (e: any) {
      setImportError(e?.message || "Failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function runOmdbImportByImdb() {
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/import/omdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "imdb", imdbId: omdbImdbId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setImportResult(json.movie);
    } catch (e: any) {
      setImportError(e?.message || "Failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function runTmdbImportByTitle() {
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/import/tmdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "title", title: tmdbTitle.trim(), year: tmdbYear ? Number(tmdbYear) : undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setImportResult(json.movie);
    } catch (e: any) {
      setImportError(e?.message || "Failed");
    } finally {
      setImportBusy(false);
    }
  }

  async function runTmdbImportById() {
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch("/api/admin/import/tmdb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "tmdb", tmdbId: tmdbId.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setImportResult(json.movie);
    } catch (e: any) {
      setImportError(e?.message || "Failed");
    } finally {
      setImportBusy(false);
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

        <div className="glass rounded-xl p-6 border border-white/40 sm:col-span-2">
          <h2 className="text-lg font-medium text-[#6b4a4c]">Manual Import (OMDb / TMDb)</h2>
          <p className="text-sm text-[#6b4a4c]/80 mt-1">Import a single movie by title/year or ID.</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-[#6b4a4c]">OMDb</h3>
              <div className="flex gap-3 items-end">
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">Title</span>
                  <input className="glass rounded-md px-3 py-2 w-64" value={omdbTitle} onChange={(e)=>setOmdbTitle(e.target.value)} />
                </label>
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">Year</span>
                  <input className="glass rounded-md px-3 py-2 w-28" value={omdbYear} onChange={(e)=>setOmdbYear(e.target.value)} />
                </label>
                <button disabled={importBusy || !omdbTitle.trim()} onClick={runOmdbImportByTitle} className="ml-auto glass rounded-md px-4 py-2 text-[#6b4a4c] hover:text-[#994d51] disabled:opacity-60">Import by title</button>
              </div>
              <div className="flex gap-3 items-end">
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">IMDb ID</span>
                  <input className="glass rounded-md px-3 py-2 w-64" placeholder="tt0133093" value={omdbImdbId} onChange={(e)=>setOmdbImdbId(e.target.value)} />
                </label>
                <button disabled={importBusy || !omdbImdbId.trim()} onClick={runOmdbImportByImdb} className="ml-auto glass rounded-md px-4 py-2 text-[#6b4a4c] hover:text-[#994d51] disabled:opacity-60">Import by IMDb ID</button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-medium text-[#6b4a4c]">TMDb</h3>
              <div className="flex gap-3 items-end">
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">Title</span>
                  <input className="glass rounded-md px-3 py-2 w-64" value={tmdbTitle} onChange={(e)=>setTmdbTitle(e.target.value)} />
                </label>
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">Year</span>
                  <input className="glass rounded-md px-3 py-2 w-28" value={tmdbYear} onChange={(e)=>setTmdbYear(e.target.value)} />
                </label>
                <button disabled={importBusy || !tmdbTitle.trim()} onClick={runTmdbImportByTitle} className="ml-auto glass rounded-md px-4 py-2 text-[#6b4a4c] hover:text-[#994d51] disabled:opacity-60">Import by title</button>
              </div>
              <div className="flex gap-3 items-end">
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">TMDb ID</span>
                  <input className="glass rounded-md px-3 py-2 w-64" placeholder="603" value={tmdbId} onChange={(e)=>setTmdbId(e.target.value)} />
                </label>
                <button disabled={importBusy || !tmdbId.trim()} onClick={runTmdbImportById} className="ml-auto glass rounded-md px-4 py-2 text-[#6b4a4c] hover:text-[#994d51] disabled:opacity-60">Import by TMDb ID</button>
              </div>
            </div>
          </div>

          {importError && <p className="text-sm text-red-600 mt-3">{importError}</p>}
          {importResult && (
            <div className="text-sm text-[#6b4a4c] mt-3">
              <div className="font-medium">Imported/Updated:</div>
              <div className="truncate">{importResult.title} {importResult.year ? `(${importResult.year})` : ""} {importResult.imdbID ? `- ${importResult.imdbID}` : ""}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
