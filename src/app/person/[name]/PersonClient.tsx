"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "~/trpc/react";

const ACTING_PERFORMANCE_CRITERIA_ID = "2055d1c8-87e6-459f-860d-aae443b8a297";

type Role = "actor" | "writer" | "director";

export default function PersonClient({ name }: { name: string }) {
  const { data, isLoading, isFetching } = api.movie.getPersonOverview.useQuery({
    name,
    maxPerRole: 18,
    actorCriteriaId: ACTING_PERFORMANCE_CRITERIA_ID,
  });
  const personInfo = api.movie.getPersonInfo.useQuery({ name });

  // Filters / Explore state
  const [role, setRole] = useState<Role>("actor");
  const [minScore, setMinScore] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"score" | "year" | "title">("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const personMovies = api.movie.getPersonMovies.useQuery({
    name,
    role,
    actorCriteriaId: role === "actor" ? ACTING_PERFORMANCE_CRITERIA_ID : undefined,
  });

  const years = useMemo(() => {
    const ys = (personMovies.data ?? []).map(m => m.year ?? 0).filter(Boolean) as number[];
    if (ys.length === 0) return { min: 0, max: 0 };
    return { min: Math.min(...ys), max: Math.max(...ys) };
  }, [personMovies.data]);
  const [yearFrom, setYearFrom] = useState<number | undefined>(undefined);
  const [yearTo, setYearTo] = useState<number | undefined>(undefined);
  const effectiveYearFrom = yearFrom ?? years.min;
  const effectiveYearTo = yearTo ?? years.max;

  const filtered = useMemo(() => {
    const list = personMovies.data ?? [];
    const withScore = list.map(m => ({
      ...m,
      effScore: role === "actor" ? (m.actorScore ?? m.score ?? 0) : (m.score ?? 0),
    }));
    const byYear = withScore.filter(m => {
      const y = m.year ?? 0;
      const inYear = (effectiveYearFrom ? y >= effectiveYearFrom : true) && (effectiveYearTo ? y <= effectiveYearTo : true);
      return inYear && m.effScore >= minScore;
    });
    byYear.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "score") return dir * ((a.effScore) - (b.effScore));
      if (sortBy === "year") return dir * ((a.year ?? 0) - (b.year ?? 0));
      return dir * (a.title?.localeCompare(b.title ?? "") ?? 0);
    });
    return byYear;
  }, [personMovies.data, role, effectiveYearFrom, effectiveYearTo, minScore, sortBy, sortDir]);

  // Infinite scroll for Explore grid
  const [showCount, setShowCount] = useState(24);
  useEffect(() => { setShowCount(24); }, [role, minScore, sortBy, sortDir, effectiveYearFrom, effectiveYearTo, personMovies.data]);
  const visible = useMemo(() => filtered.slice(0, showCount), [filtered, showCount]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          setShowCount((c) => Math.min(filtered.length, c + 24));
        }
      }
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  return (
    <div className="relative flex size-full min-h-screen flex-col bg-gradient-to-br from-[#fcf8f8] via-[#f9f2f3] to-[#f5e8e9]" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        {/* Hero using best available poster */}
        {data && (
          <Hero name={name} posters={[...(data.actor ?? []), ...(data.director ?? []), ...(data.writer ?? [])].map(m => m.posterUrl).filter(Boolean) as string[]} />
        )}
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1 gap-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="text-[#1b0e0e] tracking-light text-[32px] font-bold leading-tight">{name}</h1>
                {data && (
                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#6b4a4c]">
                    <span>Avg rating {data.average.toFixed(2)}</span>
                    <span>•</span>
                    <Link className="underline hover:text-[#994d51]" href={`/?actor=${encodeURIComponent(name)}`}>Actor {data.counts.actor}</Link>
                    <span>•</span>
                    <Link className="underline hover:text-[#994d51]" href={`/?director=${encodeURIComponent(name)}`}>Director {data.counts.director}</Link>
                    <span>•</span>
                    <Link className="underline hover:text-[#994d51]" href={`/?writer=${encodeURIComponent(name)}`}>Writer {data.counts.writer}</Link>
                  </div>
                )}
              </div>
              <Link href="/best/people" className="glass rounded-xl px-4 py-2 text-sm font-semibold text-[#1b0e0e] border border-white/30 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 hover:scale-105 hover:text-[#994d51]">⟵ Best People</Link>
            </div>

            {/* Person info (Wikipedia) */}
            <div className="rounded-2xl border border-white/20 bg-white/70 p-4 flex gap-4 items-start">
              {personInfo.data?.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={personInfo.data.thumbnailUrl} alt={personInfo.data.title} className="h-20 w-20 rounded-xl object-cover border border-white/40" />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-[#f3e7e8] border border-white/40" />
              )}
              <div className="flex-1">
                <div className="text-sm text-[#6b4a4c]">
                  {personInfo.isFetching && <span>Loading profile…</span>}
                  {!personInfo.isFetching && personInfo.data?.extract && (
                    <span>{personInfo.data.extract}</span>
                  )}
                  {!personInfo.isFetching && !personInfo.data?.extract && (
                    <span>No bio available.</span>
                  )}
                </div>
                <div className="mt-2 text-xs">
                  {personInfo.data?.wikipediaUrl && (
                    <a href={personInfo.data.wikipediaUrl} target="_blank" rel="noopener noreferrer" className="text-[#994d51] hover:underline">Wikipedia</a>
                  )}
                </div>
              </div>
            </div>

            {(isLoading || isFetching) && <div className="text-sm text-[#1b0e0e]">Loading…</div>}
            {data == null && !(isLoading || isFetching) && <div className="text-sm text-[#1b0e0e]">No data for this person.</div>}

            {data && (
              <div className="flex flex-col gap-8">
                {/* Mini charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Role breakdown bars */}
                  <div className="rounded-2xl border border-white/20 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-[#1b0e0e] mb-2">Role breakdown</div>
                    <RoleBreakdownBars counts={data.counts} />
                  </div>
                  {/* Score distribution */}
                  <div className="rounded-2xl border border-white/20 bg-white/60 p-4">
                    <div className="text-sm font-semibold text-[#1b0e0e] mb-2">Score distribution</div>
                    <ScoreDistribution movies={{
                      actor: data.actor ?? [],
                      director: data.director ?? [],
                      writer: data.writer ?? [],
                    }} />
                  </div>
                </div>

                {/* Explore section with filters */}
                <section className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/60 p-4">
                  <div className="flex flex-wrap items-end gap-3 sticky top-4 z-10 bg-white/60 backdrop-blur-xl rounded-xl p-2 border border-white/30">
                    <label className="flex flex-col">
                      <span className="text-xs text-[#6b4a4c]">Role</span>
                      <select className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]" value={role} onChange={e => setRole(e.target.value as Role)}>
                        <option value="actor">Actor</option>
                        <option value="director">Director</option>
                        <option value="writer">Writer</option>
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-[#6b4a4c]">Sort by</span>
                      <select className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                        <option value="score">Score</option>
                        <option value="year">Year</option>
                        <option value="title">Title</option>
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-[#6b4a4c]">Direction</span>
                      <select className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]" value={sortDir} onChange={e => setSortDir(e.target.value as any)}>
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-[#6b4a4c]">Min score</span>
                      <input type="number" min={0} max={5} step={0.1} className="w-24 rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]" value={minScore} onChange={e => setMinScore(Math.max(0, Math.min(5, Number(e.target.value) || 0)))} />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-[#6b4a4c]">Year from</span>
                      <input type="number" className="w-28 rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]" value={effectiveYearFrom || ''} onChange={e => setYearFrom(e.target.value === '' ? undefined : Number(e.target.value))} />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-xs text-[#6b4a4c]">Year to</span>
                      <input type="number" className="w-28 rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]" value={effectiveYearTo || ''} onChange={e => setYearTo(e.target.value === '' ? undefined : Number(e.target.value))} />
                    </label>
                    <div className="ml-auto text-xs text-[#6b4a4c]">{personMovies.isFetching ? 'Loading…' : `${filtered.length} results`}</div>
                  </div>

                  {/* Yearly trend mini chart for filtered results */}
                  <div className="rounded-xl border border-white/30 bg-white/70 p-3">
                    <div className="text-xs font-semibold text-[#1b0e0e] mb-2">Yearly trend ({role})</div>
                    <YearlyTrend data={filtered.map(m => ({ year: m.year ?? 0, value: m.effScore }))} />
                  </div>

                  {/* Extra charts: role distribution, scatter, top years */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="rounded-xl border border-white/30 bg-white/70 p-3">
                      <div className="text-xs font-semibold text-[#1b0e0e] mb-2">{role} score distribution</div>
                      <InlineHistogram values={filtered.map(f => f.effScore)} />
                    </div>
                    <div className="rounded-xl border border-white/30 bg-white/70 p-3">
                      <div className="text-xs font-semibold text-[#1b0e0e] mb-2">Score vs year</div>
                      <ScoreYearScatter points={filtered.map(f => ({ x: f.year ?? 0, y: f.effScore }))} />
                    </div>
                    <div className="rounded-xl border border-white/30 bg-white/70 p-3">
                      <div className="text-xs font-semibold text-[#1b0e0e] mb-2">Top years</div>
                      <TopYearsList years={filtered.map(f => f.year ?? 0)} />
                    </div>
                  </div>

                  {/* Explore grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {filtered.length === 0 && !personMovies.isFetching && (
                      <div className="col-span-full text-center text-sm text-[#6b4a4c]">No results match your filters.</div>
                    )}
                    {visible.map((m) => (
                      <Link href={`/${m.id}`} key={`explore-${m.id}`} className="group focus:outline-none" aria-label={`Open ${m.title ?? 'movie'} details`}>
                        <div className="flex flex-col rounded-2xl overflow-hidden bg-white/80 border border-white/20 shadow-sm transition transform duration-200 ease-out motion-reduce:transition-none motion-reduce:transform-none hover:shadow-lg hover:-translate-y-[2px] focus-within:shadow-lg">
                          <div className="aspect-[2/3] bg-[#f3e7e8] flex items-center justify-center overflow-hidden">
                            {m.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.posterUrl} alt={m.title ?? ''} className="w-full h-full object-cover transition-transform duration-200 ease-out motion-reduce:transition-none group-hover:scale-[1.02]" />
                            ) : (
                              <div className="text-[#6b4a4c] text-xs">No poster</div>
                            )}
                          </div>
                          <div className="p-3 focus:outline-none">
                            <div className="text-sm font-semibold text-[#1b0e0e] truncate group-focus-visible:outline-none" title={m.title ?? ''}>{m.title ?? ''}</div>
                            <div className="text-xs text-[#6b4a4c]">{m.year ?? ''}</div>
                            <div className="mt-1 text-xs text-[#1b0e0e]">{m.effScore.toFixed(2)}</div>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {visible.length < filtered.length && (
                      <div ref={sentinelRef} className="col-span-full h-10" aria-hidden="true" />
                    )}
                  </div>
                </section>

                {(["actor", "director", "writer"] as const).map((role) => {
                  const list = data[role];
                  if (!list || list.length === 0) return null;
                  return (
                    <section key={role} className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-[#1b0e0e]">
                          {role.charAt(0).toUpperCase() + role.slice(1)} • {list.length} best
                        </h2>
                        <Link
                          href={`/?${role}=${encodeURIComponent(name)}`}
                          className="text-sm text-[#994d51] hover:underline"
                        >View all</Link>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {list.map((m) => (
                          <Link href={`/${m.id}`} key={`${role}-${m.id}`} className="group">
                            <div className="flex flex-col rounded-2xl overflow-hidden bg-white/80 border border-white/20 shadow-sm hover:shadow-md transition-shadow">
                              <div className="aspect-[2/3] bg-[#f3e7e8] flex items-center justify-center overflow-hidden">
                                {m.posterUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={m.posterUrl} alt={m.title ?? ''} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                                ) : (
                                  <div className="text-[#6b4a4c] text-xs">No poster</div>
                                )}
                              </div>
                              <div className="p-3">
                                <div className="text-sm font-semibold text-[#1b0e0e] truncate" title={m.title ?? ''}>{m.title ?? ''}</div>
                                <div className="text-xs text-[#6b4a4c]">{m.year ?? ''}</div>
                                <div className="mt-1 text-xs text-[#1b0e0e]">
                                  {role === 'actor' && m.actorScore != null ? (
                                    <>Perf {m.actorScore.toFixed(2)}</>
                                  ) : (
                                    <>Overall {((m.score ?? 0)).toFixed(2)}</>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineHistogram({ values }: { values: number[] }) {
  const bins = 10;
  const min = 0, max = 5;
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const cl = Math.max(min, Math.min(max, v));
    const idx = Math.min(bins - 1, Math.floor(((cl - min) / (max - min)) * bins));
    counts[idx]++;
  }
  const peak = Math.max(1, ...counts);
  const w = 300, h = 80, gap = 2;
  const bw = (w - gap * (bins - 1)) / bins;
  return (
    <svg width={w} height={h} className="block">
      <line x1={0} y1={h - 16} x2={w} y2={h - 16} stroke="#e7d0d1" />
      {counts.map((c, i) => {
        const bh = (c / peak) * (h - 24);
        const x = i * (bw + gap);
        const y = (h - 16) - bh;
        return <rect key={i} x={x} y={y} width={bw} height={bh} rx={3} fill="#994d51" opacity={0.9} />;
      })}
      <text x={0} y={h - 2} fontSize={10} fill="#6b4a4c">0</text>
      <text x={w - 12} y={h - 2} fontSize={10} fill="#6b4a4c">5</text>
    </svg>
  );
}

function ScoreYearScatter({ points }: { points: Array<{ x: number; y: number }> }) {
  const data = points.filter(p => p.x && p.y >= 0);
  if (data.length === 0) return <div className="text-xs text-[#6b4a4c]">No data</div>;
  const minX = Math.min(...data.map(p => p.x));
  const maxX = Math.max(...data.map(p => p.x));
  const minY = 0, maxY = 5;
  const w = 300, h = 120, pad = 28;
  const sx = (x: number) => pad + ((x - minX) / Math.max(1, maxX - minX)) * (w - 2 * pad);
  const sy = (y: number) => h - pad - ((y - minY) / Math.max(0.0001, maxY - minY)) * (h - 2 * pad);
  return (
    <svg width={w} height={h} className="block">
      <rect x={0} y={0} width={w} height={h} fill="#fff" opacity={0.4} rx={12} />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e7d0d1" />
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#e7d0d1" />
      {data.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3} fill="#994d51" opacity={0.9} />
      ))}
      <text x={pad} y={h - 6} fontSize={10} fill="#6b4a4c">{minX}</text>
      <text x={w - pad - 16} y={h - 6} fontSize={10} fill="#6b4a4c">{maxX}</text>
      <text x={4} y={pad + 4} fontSize={10} fill="#6b4a4c">5</text>
      <text x={6} y={h - pad} fontSize={10} fill="#6b4a4c">0</text>
    </svg>
  );
}

function TopYearsList({ years }: { years: number[] }) {
  const map = new Map<number, number>();
  for (const y of years) {
    if (!y) continue;
    map.set(y, (map.get(y) ?? 0) + 1);
  }
  const items = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .slice(0, 8);
  if (items.length === 0) return <div className="text-xs text-[#6b4a4c]">No data</div>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([y, c]) => (
        <div key={y} className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/70 px-3 py-1 text-xs text-[#1b0e0e]">
          <span className="font-semibold">{y}</span>
          <span className="text-[#6b4a4c]">{c}</span>
        </div>
      ))}
    </div>
  );
}

function RoleBreakdownBars({ counts }: { counts: { actor: number; writer: number; director: number } }) {
  const entries: Array<{ label: string; value: number; color: string }> = [
    { label: 'Actor', value: counts.actor, color: '#994d51' },
    { label: 'Director', value: counts.director, color: '#7a3d41' },
    { label: 'Writer', value: counts.writer, color: '#b86a70' },
  ];
  const max = Math.max(1, ...entries.map(e => e.value));
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.label} className="flex items-center gap-3 text-xs text-[#1b0e0e]">
          <div className="w-20">{e.label}</div>
          <div className="h-2 flex-1 rounded-full bg-[#f3e7e8] overflow-hidden">
            <div className="h-full" style={{ width: `${(e.value / max) * 100}%`, background: e.color }} />
          </div>
          <div className="w-8 text-right tabular-nums">{e.value}</div>
        </div>
      ))}
    </div>
  );
}

function ScoreDistribution({ movies }: { movies: { actor: Array<{ score?: number; actorScore?: number }>; director: Array<{ score?: number }>; writer: Array<{ score?: number }> } }) {
  // Collect scores, prefer actorScore for actor role when present
  const vals: number[] = [];
  for (const m of movies.actor) vals.push((m.actorScore ?? m.score ?? 0));
  for (const m of movies.director) vals.push((m.score ?? 0));
  for (const m of movies.writer) vals.push((m.score ?? 0));
  // Bucket 0..5 into 10 bins of 0.5
  const bins = new Array(10).fill(0);
  for (const v of vals) {
    const clamped = Math.max(0, Math.min(5, v));
    const idx = Math.min(9, Math.floor(clamped / 0.5));
    bins[idx]++;
  }
  const max = Math.max(1, ...bins);
  const w = 240, h = 80, barGap = 2;
  const barWidth = (w - (bins.length - 1) * barGap) / bins.length;
  return (
    <svg width={w} height={h} className="block">
      {/* axis */}
      <line x1={0} y1={h - 16} x2={w} y2={h - 16} stroke="#e7d0d1" />
      {bins.map((b, i) => {
        const bh = ((b / max) * (h - 24));
        const x = i * (barWidth + barGap);
        const y = (h - 16) - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barWidth} height={bh} fill="#994d51" opacity={0.9} rx={3} />
          </g>
        );
      })}
      {/* labels */}
      <text x={0} y={h - 2} fontSize={10} fill="#6b4a4c">0</text>
      <text x={w - 12} y={h - 2} fontSize={10} fill="#6b4a4c">5</text>
    </svg>
  );
}

function YearlyTrend({ data }: { data: Array<{ year: number; value: number }> }) {
  const points = data
    .filter(d => d.year && d.value >= 0)
    .sort((a, b) => a.year - b.year);
  if (points.length === 0) return <div className="text-xs text-[#6b4a4c]">No data</div>;
  const minV = Math.min(...points.map(p => p.value));
  const maxV = Math.max(...points.map(p => p.value));
  const minYear = Math.min(...points.map(p => p.year));
  const maxYear = Math.max(...points.map(p => p.year));
  const w = 560, h = 120, pad = 24;
  const x = (yr: number) => pad + ((yr - minYear) / Math.max(1, maxYear - minYear)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - minV) / Math.max(0.0001, maxV - minV)) * (h - 2 * pad);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.year)} ${y(p.value)}`).join(' ');
  return (
    <svg width={w} height={h} className="block">
      <rect x={0} y={0} width={w} height={h} fill="#fff" opacity={0.4} rx={12} />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#e7d0d1" />
      <path d={path} fill="none" stroke="#994d51" strokeWidth={2} />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.year)} cy={y(p.value)} r={2.5} fill="#994d51" />
      ))}
      <text x={pad} y={h - 6} fontSize={10} fill="#6b4a4c">{minYear}</text>
      <text x={w - pad - 16} y={h - 6} fontSize={10} fill="#6b4a4c">{maxYear}</text>
    </svg>
  );
}

function Hero({ name, posters }: { name: string; posters: string[] }) {
  const bg = posters[0] ?? null;
  return (
    <div className="relative w-full">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 lg:px-40">
        <div className="relative overflow-hidden rounded-2xl border border-white/30" style={{ height: 240 }}>
          {bg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bg} alt={name} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-[#f3e7e8] to-[#e7d0d1]" />
          )}
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm" />
          <div className="absolute inset-0 flex items-end">
            <div className="p-6">
              <div className="inline-flex items-center gap-3 rounded-xl bg-white/70 px-4 py-2 text-[#1b0e0e] shadow-elegant">
                <span className="text-sm">Explore</span>
                <strong className="text-lg">{name}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
