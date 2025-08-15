"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";

const ACTING_PERFORMANCE_CRITERIA_ID = "2055d1c8-87e6-459f-860d-aae443b8a297";

type Role = "actor" | "writer" | "director";

type SortBy = "avg" | "count";

type SortDir = "asc" | "desc";

export default function PeopleBestClient() {
  const [role, setRole] = useState<Role>("actor");
  const [minMovies, setMinMovies] = useState<number | undefined>(undefined);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<SortBy | undefined>(undefined);
  const [sortDir, setSortDir] = useState<SortDir | undefined>(undefined);

  const params = useMemo(() => ({
    role,
    page,
    ...(pageSize !== undefined ? { pageSize } : {}),
    ...(minMovies !== undefined ? { minMovies } : {}),
    ...(sortBy !== undefined ? { sortBy } : {}),
    ...(sortDir !== undefined ? { sortDir } : {}),
    actorCriteriaId: role === "actor" ? ACTING_PERFORMANCE_CRITERIA_ID : undefined,
  }), [role, page, pageSize, minMovies, sortBy, sortDir]);

  const { data, isLoading, refetch, isFetching } = api.movie.getTopPeopleByRole.useQuery(params);

  const total = data?.total ?? 0;
  const effectivePageSize = data?.pageSize ?? pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize));

  // Reset to page 1 when role or filters change
  function updateRole(r: Role) {
    setRole(r);
    setPage(1);
  }

  function applyFilters() {
    setPage(1);
    refetch().catch(() => {});
  }

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-gradient-to-br from-[#fcf8f8] via-[#f9f2f3] to-[#f5e8e9] group/design-root overflow-x-hidden" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1 gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <h1 className="text-[#1b0e0e] tracking-light text-[32px] font-bold leading-tight">Best People</h1>
              <div className="inline-flex rounded-xl border border-[#e7d0d1] bg-white/80 p-1 shadow-sm">
                {(["actor", "writer", "director"] as Role[]).map((r) => (
                  <button
                    key={r}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${role === r ? 'bg-[#994d51] text-white' : 'text-[#1b0e0e] hover:bg-[#f3e7e8]'}`}
                    onClick={() => updateRole(r)}
                  >{r.charAt(0).toUpperCase() + r.slice(1)}s</button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/60 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">Min movies</span>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]"
                      value={minMovies === undefined ? "" : String(minMovies)}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMinMovies(v === "" ? undefined : Math.max(1, Number(v) || 1));
                        setPage(1);
                      }}
                    >
                      <option value="">Default</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </label>
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">Page size</span>
                  <select
                    className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]"
                    value={pageSize === undefined ? "" : String(pageSize)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPageSize(v === "" ? undefined : Number(v));
                      setPage(1);
                    }}
                  >
                    <option value="">Default</option>
                    {[12, 24, 36, 48, 60, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">Sort by</span>
                  <select
                    className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]"
                    value={sortBy ?? ""}
                    onChange={(e) => {
                      const v = e.target.value as SortBy | "";
                      setSortBy(v === "" ? undefined : (v as SortBy));
                      setPage(1);
                    }}
                  >
                    <option value="">Default</option>
                    <option value="avg">Avg rating</option>
                    <option value="count">Movie count</option>
                  </select>
                </label>
                <label className="flex flex-col">
                  <span className="text-xs text-[#6b4a4c]">Direction</span>
                  <select
                    className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]"
                    value={sortDir ?? ""}
                    onChange={(e) => {
                      const v = e.target.value as SortDir | "";
                      setSortDir(v === "" ? undefined : (v as SortDir));
                      setPage(1);
                    }}
                  >
                    <option value="">Default</option>
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </label>
                <button
                  className="ml-auto rounded-xl bg-[#994d51] px-3 py-2 text-sm text-white hover:bg-[#7a3d41]"
                  onClick={applyFilters}
                  disabled={isFetching}
                >Apply</button>
              </div>
              <div className="text-xs text-[#6b4a4c]">{role === 'actor' ? `Using sub-criteria for Acting Performance (${ACTING_PERFORMANCE_CRITERIA_ID})` : 'Using overall movie rating'}</div>
            </div>

            {(isLoading || isFetching) && (
              <div className="text-sm text-[#1b0e0e]">Loading...</div>
            )}

            {data && data.items.length === 0 && (
              <div className="text-sm text-[#1b0e0e]">No results. Try lowering min movies.</div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {data?.items.map((p) => (
                <Link href={`/${p.bestMovieId}`} key={`${p.name}-${p.bestMovieId}`} className="group">
                  <div className="flex flex-col rounded-2xl overflow-hidden bg-white/80 border border-white/20 shadow-sm hover:shadow-md transition-shadow">
                    <div className="aspect-[2/3] bg-[#f3e7e8] flex items-center justify-center overflow-hidden">
                      {p.bestPosterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.bestPosterUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                      ) : (
                        <div className="text-[#6b4a4c] text-xs">No poster</div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-semibold text-[#1b0e0e] truncate" title={p.name}>{p.name}</div>
                      <div className="text-xs text-[#6b4a4c] truncate" title={p.bestMovieTitle ?? ''}>{p.bestMovieTitle ?? ''}</div>
                      <div className="mt-1 text-xs text-[#1b0e0e]">Avg {p.avg.toFixed(2)} • {p.count} movies</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-between py-4">
              <div className="text-sm text-[#6b4a4c]">Total: {total}</div>
              <div className="inline-flex items-center gap-2">
                <button
                  className="px-3 py-1.5 rounded-lg border border-[#e7d0d1] bg-white text-sm disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >Prev</button>
                <span className="text-sm text-[#1b0e0e]">Page {page} / {totalPages}</span>
                <button
                  className="px-3 py-1.5 rounded-lg border border-[#e7d0d1] bg-white text-sm disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
