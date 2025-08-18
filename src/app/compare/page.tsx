import { db } from "~/server/db";
import { evaluation, evaluationScore, criteria, movie } from "~/server/db/schema";
import { inArray } from "drizzle-orm";
import Link from "next/link";

export default async function Compare({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids = "" } = await searchParams;
  const idList = ids.split(",").map(s => s.trim()).filter(Boolean);
  if (idList.length === 0) {
    return (
      <div className="px-4 sm:px-8 lg:px-40 py-10">
        <div className="glass-strong rounded-2xl p-6 text-[#1b0e0e]">
          <p className="font-semibold">No movies selected.</p>
          <p className="text-sm opacity-80">Go back and pick movies with the "Cmp" button, then open the dock.</p>
          <div className="mt-4">
            <Link className="text-[#994d51] underline" href="/">← Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const movies = await db.select().from(movie).where(inArray(movie.id, idList));
  const allCriteria = await db.select().from(criteria);
  const mainCriteria = allCriteria.filter(c => !c.parentId);
  const subCriteria = allCriteria.filter(c => c.parentId);

  const evals = await db.select().from(evaluation).where(inArray(evaluation.movieId, idList));
  const evalIds = evals.map(e => e.id);
  const scores = await db.select().from(evaluationScore).where(inArray(evaluationScore.evaluationId, evalIds));

  const scoresByEval: Record<string, {criteriaId: string, score: number}[]> = {};
  for (const s of scores) {
    const eid = s.evaluationId as string;
    if (!scoresByEval[eid]) scoresByEval[eid] = [];
    scoresByEval[eid].push({ criteriaId: s.criteriaId as string, score: Number(s.score) });
  }

  function compute(movId: string) {
    const myEvals = evals.filter(e => e.movieId === movId).map(e => e.id);
    const subAvg: Record<string, number> = {};
    for (const sub of subCriteria) {
      const sid = sub.id ? String(sub.id) : "";
      if (!sid) continue;
      const arr: number[] = [];
      for (const evId of myEvals) {
        const arrScores = scoresByEval[evId] || [];
        const found = arrScores.find(s => s.criteriaId === sub.id);
        if (found) arr.push(found.score);
      }
      if (arr.length) subAvg[sid] = Math.round((arr.reduce((a,b)=>a+b,0)/arr.length)*10)/10;
    }
    const mainVals: Record<string, number> = {};
    let wSum = 0, wTotal = 0;
    for (const main of mainCriteria) {
      const mid = main.id ? String(main.id) : "";
      if (!mid) continue;
      const subs = subCriteria.filter(s => String(s.parentId ?? "") === mid);
      let sw = 0, tw = 0;
      for (const sub of subs) {
        const sid = sub.id ? String(sub.id) : "";
        if (!sid) continue;
        const w = Number(sub.weight ?? 0);
        if (subAvg[sid] !== undefined && w > 0) {
          sw += (subAvg[sid] ?? 0) * w;
          tw += w;
        }
      }
      if (tw > 0) {
        const v = Math.round((sw / tw) * 10) / 10;
        mainVals[mid] = v;
        const mw = Number(main.weight ?? 0);
        if (mw > 0) { wSum += v * mw; wTotal += mw; }
      }
    }
    const overall = wTotal > 0 ? Math.round((wSum / wTotal) * 10) / 10 : undefined;
    return { subAvg, mainVals, overall };
  }

  const computed = Object.fromEntries(movies.map(m => [String(m.id), compute(String(m.id))] as const));

  return (
    <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-[#1b0e0e]">Compare</h1>
              <Link className="text-[#994d51] underline" href="/">← Back</Link>
            </div>

            {/* Insights: Yearly trend and per-criteria distributions */}
            {movies.length > 0 && (
              <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Yearly trend: overall by movie year (scatter) */}
                {(() => {
                  const pts = movies
                    .map(m => ({ y: Number(m.year ?? 0), v: computed[m.id]?.overall ?? undefined, title: m.title ?? '' }))
                    .filter(p => p.y && p.v !== undefined);
                  if (!pts.length) return <div className="glass-strong rounded-2xl border border-white/40 p-4 text-[#6b4a4c] text-sm">No yearly data.</div>;
                  const years = pts.map(p => p.y);
                  const minY = Math.min(...years), maxY = Math.max(...years);
                  const minX = minY - 0.5, maxX = maxY + 0.5; // padding
                  const size = { w: 520, h: 180, pad: 30 };
                  const x = (yr: number) => size.pad + ((yr - minX) / (maxX - minX || 1)) * (size.w - size.pad * 2);
                  const yv = (v: number) => size.h - size.pad - (v / 10) * (size.h - size.pad * 2);
                  const xTicks = Array.from(new Set(years)).sort((a,b)=>a-b);
                  return (
                    <div className="glass-strong rounded-2xl border border-white/40 p-4">
                      <h3 className="text-sm font-semibold text-[#1b0e0e] mb-2">Yearly Trend (Overall)</h3>
                      <svg width={size.w} height={size.h} className="w-full h-auto">
                        <rect x={size.pad} y={size.pad} width={size.w - size.pad * 2} height={size.h - size.pad * 2} fill="#fff" fillOpacity={0.6} rx={8} />
                        {xTicks.map((yr, i) => (
                          <g key={i}>
                            <line x1={x(yr)} y1={size.pad} x2={x(yr)} y2={size.h - size.pad} stroke="#f3e7e8" />
                            <text x={x(yr)} y={size.h - size.pad + 14} textAnchor="middle" fontSize={10} fill="#6b4a4c">{yr}</text>
                          </g>
                        ))}
                        {[2.5,5,7.5,10].map((v, i) => (
                          <g key={i}>
                            <line x1={size.pad} y1={yv(v)} x2={size.w - size.pad} y2={yv(v)} stroke="#f3e7e8" />
                            <text x={size.pad - 6} y={yv(v)+3} textAnchor="end" fontSize={10} fill="#6b4a4c">{v}</text>
                          </g>
                        ))}
                        {pts.map((p, i) => (
                          <circle key={i} cx={x(p.y)} cy={yv(p.v as number)} r={4} fill="#994d51">
                            <title>{`${p.title} (${p.y}) — ${(p.v as number).toFixed(1)}`}</title>
                          </circle>
                        ))}
                      </svg>
                    </div>
                  );
                })()}

                {/* Per-criteria distributions: min-max-avg across selected */}
                {(() => {
                  const rows = mainCriteria.map(main => {
                    const vals = movies.map(m => (computed[m.id]?.mainVals[main.id as string] ?? undefined)).filter((v): v is number => typeof v === 'number');
                    if (!vals.length) return { id: main.id as string, name: main.name as string, vals: [] as number[], min: 0, max: 0, avg: 0 };
                    const min = Math.min(...vals), max = Math.max(...vals), avg = vals.reduce((a,b)=>a+b,0)/vals.length;
                    return { id: main.id as string, name: main.name as string, vals, min, max, avg };
                  }).filter(r => r.vals.length > 0);
                  if (!rows.length) return <div className="glass-strong rounded-2xl border border-white/40 p-4 text-[#6b4a4c] text-sm">No criterion data.</div>;
                  return (
                    <div className="glass-strong rounded-2xl border border-white/40 p-4">
                      <h3 className="text-sm font-semibold text-[#1b0e0e] mb-2">Per-criteria Distribution</h3>
                      <div className="space-y-2">
                        {rows.map(r => (
                          <div key={r.id} className="flex items-center gap-3 text-xs text-[#1b0e0e]">
                            <div className="w-44 truncate" title={r.name}>{r.name}</div>
                            <div className="relative h-2 flex-1 rounded-full bg-[#f3e7e8]">
                              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-white/70" />
                              {/* range */}
                              <div className="absolute top-0 bottom-0 rounded-full bg-[#e7d0d1]" style={{ left: `${(r.min/10)*100}%`, width: `${((r.max-r.min)/10)*100}%` }} />
                              {/* avg marker */}
                              <div className="absolute top-1/2 -translate-y-1/2 -ml-[3px] w-[6px] h-[6px] rounded-full bg-[#7a3d41]" style={{ left: `${(r.avg/10)*100}%` }} />
                            </div>
                            <div className="w-24 flex justify-between">
                              <span>{r.min.toFixed(1)}</span>
                              <span className="font-semibold">{r.avg.toFixed(1)}</span>
                              <span>{r.max.toFixed(1)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-x-4 text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-[#6b4a4c] font-semibold">Criterion</th>
                    {movies.map(m => (
                      <th key={m.id} className="text-left">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {m.posterUrl ? <img src={m.posterUrl} alt={m.title ?? ''} className="w-10 h-14 object-cover rounded"/> : <div className="w-10 h-14 rounded bg-white/60" />}
                          <div>
                            <div className="font-semibold text-[#1b0e0e] leading-tight line-clamp-2 max-w-[220px]">{m.title}</div>
                            <div className="text-xs text-[#6b4a4c]">{m.year} • {m.type}</div>
                            {computed[m.id]?.overall !== undefined && (
                              <div className="mt-1 flex items-center gap-2">
                                <div className="h-2 w-28 rounded-full bg-[#e7d0d1] overflow-hidden">
                                  <div className="h-full bg-[#994d51]" style={{ width: `${(computed[m.id].overall ?? 0) * 20}%` }} />
                                </div>
                                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white px-2 py-0.5 text-[10px] font-bold">
                                  <span>⭐</span>
                                  <span>{computed[m.id].overall?.toFixed(1)}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mainCriteria.map(main => (
                    <tr key={main.id}>
                      <td className="py-3 align-top text-[#1b0e0e] font-semibold">{main.name}</td>
                      {movies.map(m => (
                        <td key={m.id} className="py-3 align-top">
                          {computed[m.id]?.mainVals[main.id] !== undefined ? (
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-32 rounded-full bg-[#e7d0d1] overflow-hidden">
                                <div className="h-full bg-[#7a3d41]" style={{ width: `${(computed[m.id]?.mainVals[main.id] ?? 0) * 20}%` }} />
                              </div>
                              <span className="text-xs text-[#1b0e0e] font-semibold">{computed[m.id]?.mainVals[main.id]?.toFixed(1)}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#6b4a4c]">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
