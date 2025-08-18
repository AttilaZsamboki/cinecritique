import { db } from "~/server/db";
import { inArray } from "drizzle-orm";
import { criteria, evaluation, evaluationScore, movie } from "~/server/db/schema";
import { InteractiveCard } from "~/components/ui/InteractiveCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

function parseBoxOffice(v?: string | null): number | undefined {
  if (!v) return undefined;
  const m = v.replace(/[^0-9.]/g, "");
  if (!m) return undefined;
  const n = Number(m);
  return Number.isFinite(n) ? n : undefined;
}

function parseAwards(v?: string | null): { oscarsWon: number; oscarsNominated: number; wins: number; nominations: number } {
  const res = { oscarsWon: 0, oscarsNominated: 0, wins: 0, nominations: 0 };
  if (!v) return res;
  const s = v.toLowerCase();
  // Oscars won
  const mWonOsc = s.match(/won\s+(\d+)\s+oscars?/i);
  if (mWonOsc) res.oscarsWon = Number(mWonOsc[1]) || 0;
  // Oscars nominations
  const mNomOsc = s.match(/nominat(?:ed|ions?)\s*(?:for)?\s*(\d+)\s+oscars?/i);
  if (mNomOsc) res.oscarsNominated = Number(mNomOsc[1]) || 0;
  // Total wins
  const mWins = s.match(/(another\s+)?(\d+)\s+wins?/i);
  if (mWins) res.wins = Math.max(res.wins, Number(mWins[2]) || 0);
  // Total nominations
  const mNoms = s.match(/(another\s+)?(\d+)\s+nominations?/i);
  if (mNoms) res.nominations = Math.max(res.nominations, Number(mNoms[2]) || 0);
  return res;
}

export default async function Dashboard() {
  // Load data
  const [movies, allCriteria, evals] = await Promise.all([
    db.select().from(movie),
    db.select().from(criteria),
    db.select().from(evaluation),
  ]);
  const evalIds = evals.map((e) => e.id);
  const scores = evalIds.length
    ? await db
        .select()
        .from(evaluationScore)
        .where(inArray(evaluationScore.evaluationId, evalIds as string[]))
    : [];

  // Criteria groupings
  const mainCriteria = allCriteria.filter((c) => !c.parentId);
  const subCriteria = allCriteria.filter((c) => c.parentId);

  // Group scores by evaluation
  const scoresByEval: Record<string, { criteriaId: string; score: number }[]> = {};
  for (const s of scores) {
    const eid = String(s.evaluationId);
    if (!scoresByEval[eid]) scoresByEval[eid] = [];
    scoresByEval[eid].push({ criteriaId: String(s.criteriaId), score: Number(s.score) });
  }

  // Compute per-movie main values and overall (same logic as compare)
  function compute(movieId: string) {
    const myEvals = evals.filter((e) => String(e.movieId) === movieId).map((e) => String(e.id));
    const subAvg: Record<string, number> = {};
    for (const sub of subCriteria) {
      const sid = String(sub.id ?? "");
      if (!sid) continue;
      const arr: number[] = [];
      for (const evId of myEvals) {
        const arrScores = scoresByEval[evId] || [];
        const found = arrScores.find((s) => s.criteriaId === sid);
        if (found) arr.push(found.score);
      }
      if (arr.length) subAvg[sid] = Math.round(((arr.reduce((a, b) => a + b, 0) / arr.length) * 10)) / 10;
    }
    const mainVals: Record<string, number> = {};
    let wSum = 0,
      wTotal = 0;
    for (const main of mainCriteria) {
      const mid = String(main.id ?? "");
      if (!mid) continue;
      const subs = subCriteria.filter((s) => String(s.parentId ?? "") === mid);
      let sw = 0,
        tw = 0;
      for (const sub of subs) {
        const sid = String(sub.id ?? "");
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
        if (mw > 0) {
          wSum += v * mw;
          wTotal += mw;
        }
      }
    }
    const overall = wTotal > 0 ? Math.round(((wSum / wTotal) * 10)) / 10 : undefined;
    return { subAvg, mainVals, overall };
  }

  const computed = Object.fromEntries(movies.map((m) => [String(m.id), compute(String(m.id))] as const));

  // Aggregations for charts
  const yearly = (() => {
    const byYear: Record<string, { sum: number; n: number }> = {};
    for (const m of movies) {
      const y = Number(m.year ?? 0);
      const ov = computed[String(m.id)]?.overall;
      if (!y || ov === undefined) continue;
      if (!byYear[y]) byYear[y] = { sum: 0, n: 0 };
      byYear[y].sum += ov;
      byYear[y].n += 1;
    }
    const rows = Object.entries(byYear)
      .map(([y, { sum, n }]) => ({ year: Number(y), avg: sum / n, n }))
      .sort((a, b) => a.year - b.year);
    return rows;
  })();

  const awardsTotals = (() => {
    let oscarsWon = 0, oscarsNominated = 0, wins = 0, nominations = 0;
    const perMovie: { id: string; title: string; wins: number; nominations: number; oscarsWon: number; oscarsNominated: number }[] = [];
    for (const m of movies) {
      const p = parseAwards(m.awards);
      oscarsWon += p.oscarsWon;
      oscarsNominated += p.oscarsNominated;
      wins += p.wins;
      nominations += p.nominations;
      perMovie.push({ id: String(m.id), title: String(m.title ?? ''), ...p });
    }
    // Top by (wins + nominations + oscarsWon*3)
    const top = perMovie
      .map(r => ({ ...r, score: r.wins + r.nominations + r.oscarsWon * 3 }))
      .sort((a,b) => b.score - a.score)
      .slice(0, 10);
    return { oscarsWon, oscarsNominated, wins, nominations, perMovie, top };
  })();

  const genres = (() => {
    const counts: Record<string, number> = {};
    for (const m of movies) {
      const g = (m.genre ?? "").split(/,\s*/).filter(Boolean);
      if (!g.length) continue;
      for (const gg of g) counts[gg] = (counts[gg] ?? 0) + 1;
    }
    const rows = Object.entries(counts).map(([name, count]) => ({ name, count }));
    rows.sort((a, b) => b.count - a.count);
    return rows.slice(0, 12);
  })();

  const perCriteria = (() => {
    return mainCriteria
      .map((main) => {
        const mid = String(main.id);
        const vals: number[] = [];
        for (const m of movies) {
          const v = computed[String(m.id)]?.mainVals[mid];
          if (typeof v === "number") vals.push(v);
        }
        if (!vals.length) return null;
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        return { id: mid, name: String(main.name), min, max, avg, n: vals.length };
      })
      .filter(Boolean) as { id: string; name: string; min: number; max: number; avg: number; n: number }[];
  })();

  const boxOfficeTop = (() => {
    const rows = movies
      .map((m) => ({ id: String(m.id), title: String(m.title ?? ""), value: parseBoxOffice(m.boxOffice) }))
      .filter((r) => r.value && r.title)
      .sort((a, b) => (b.value! - a.value!))
      .slice(0, 10);
    return rows as { id: string; title: string; value: number }[];
  })();

  return (
    <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-[#1b0e0e]">Dashboard</h1>
              <Link className="text-[#994d51] underline" href="/">← Back</Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Yearly trend (avg overall by year) */}
              <InteractiveCard className="glass-strong border border-white/40 p-4">
                <h3 className="text-sm font-semibold text-[#1b0e0e] mb-2">Yearly Trend (Average Overall)</h3>
                {yearly.length ? (
                  <YearlyChart data={yearly} />
                ) : (
                  <div className="text-[#6b4a4c] text-sm">No yearly data.</div>
                )}
              </InteractiveCard>

              {/* Genre distribution */}
              <InteractiveCard className="glass-strong border border-white/40 p-4">
                <h3 className="text-sm font-semibold text-[#1b0e0e] mb-2">Top Genres</h3>
                {genres.length ? (
                  <GenreBars data={genres} />
                ) : (
                  <div className="text-[#6b4a4c] text-sm">No genre data.</div>
                )}
              </InteractiveCard>

              {/* Per-criteria distribution */}
              <InteractiveCard className="glass-strong border border-white/40 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-[#1b0e0e] mb-2">Per-criteria Distribution</h3>
                {perCriteria.length ? (
                  <CriteriaRanges data={perCriteria} />
                ) : (
                  <div className="text-[#6b4a4c] text-sm">No criteria data.</div>
                )}
              </InteractiveCard>

              {/* Top Box Office */}
              <InteractiveCard className="glass-strong border border-white/40 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-[#1b0e0e] mb-2">Top Box Office</h3>
                {boxOfficeTop.length ? (
                  <BoxOfficeBars data={boxOfficeTop} />)
                 : (<div className="text-[#6b4a4c] text-sm">No box office data.</div>)}
              </InteractiveCard>

              {/* Awards */}
              <InteractiveCard className="glass-strong border border-white/40 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-[#1b0e0e] mb-2">Awards</h3>
                {(awardsTotals.wins + awardsTotals.nominations + awardsTotals.oscarsWon + awardsTotals.oscarsNominated) ? (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div>
                      <AwardsBars
                        data={[
                          { name: 'Wins', value: awardsTotals.wins },
                          { name: 'Nominations', value: awardsTotals.nominations },
                          { name: 'Oscars Won', value: awardsTotals.oscarsWon },
                          { name: 'Oscars Nominated', value: awardsTotals.oscarsNominated },
                        ]}
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[#6b4a4c] mb-1">Top by awards</h4>
                      <div className="space-y-2">
                        {awardsTotals.top.map((r) => (
                          <div key={r.id} className="flex items-center gap-3 text-xs text-[#1b0e0e]">
                            <div className="w-72 truncate" title={r.title}>{r.title}</div>
                            <div className="ml-auto flex items-center gap-3 text-[#6b4a4c]">
                              <span title="Wins">🏆 {r.wins}</span>
                              <span title="Nominations">📜 {r.nominations}</span>
                              <span title="Oscars">🎬 {r.oscarsWon}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-[#6b4a4c] text-sm">No awards data.</div>
                )}
              </InteractiveCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function YearlyChart({ data }: { data: { year: number; avg: number; n: number }[] }) {
  const size = { w: 560, h: 200, pad: 36 };
  const minYear = Math.min(...data.map((d) => d.year));
  const maxYear = Math.max(...data.map((d) => d.year));
  const x = (yr: number) => size.pad + ((yr - minYear) / ((maxYear - minYear) || 1)) * (size.w - size.pad * 2);
  const y = (v: number) => size.h - size.pad - (v / 10) * (size.h - size.pad * 2);
  const path = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(d.year)},${y(d.avg)}`)
    .join(" ");
  return (
    <svg width={size.w} height={size.h} className="w-full h-auto">
      <rect x={size.pad} y={size.pad} width={size.w - size.pad * 2} height={size.h - size.pad * 2} fill="#fff" fillOpacity={0.6} rx={8} />
      {[2.5, 5, 7.5, 10].map((v, i) => (
        <g key={i}>
          <line x1={size.pad} y1={y(v)} x2={size.w - size.pad} y2={y(v)} stroke="#f3e7e8" />
          <text x={size.pad - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#6b4a4c">
            {v}
          </text>
        </g>
      ))}
      {data.map((d, i) => (
        <g key={i}>
          <text x={x(d.year)} y={size.h - size.pad + 14} textAnchor="middle" fontSize={10} fill="#6b4a4c">
            {d.year}
          </text>
        </g>
      ))}
      <path d={path} stroke="#994d51" fill="none" strokeWidth={2} />
      {data.map((d, i) => (
        <circle key={i} cx={x(d.year)} cy={y(d.avg)} r={3.5} fill="#994d51">
          <title>
            {d.year}: {d.avg.toFixed(2)} (n={d.n})
          </title>
        </circle>
      ))}
    </svg>
  );
}

function GenreBars({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count));
  return (
    <div className="space-y-2">
      {data.map((g) => (
        <div key={g.name} className="flex items-center gap-3 text-xs text-[#1b0e0e]">
          <div className="w-40 truncate" title={g.name}>
            {g.name}
          </div>
          <div className="h-2 flex-1 rounded-full bg-[#f3e7e8] overflow-hidden">
            <div className="h-full bg-[#7a3d41]" style={{ width: `${(g.count / max) * 100}%` }} />
          </div>
          <div className="w-8 text-right">{g.count}</div>
        </div>
      ))}
    </div>
  );
}

function CriteriaRanges({
  data,
}: {
  data: { id: string; name: string; min: number; max: number; avg: number; n: number }[];
}) {
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.id} className="flex items-center gap-3 text-xs text-[#1b0e0e]">
          <div className="w-56 truncate" title={r.name}>
            {r.name}
          </div>
          <div className="relative h-2 flex-1 rounded-full bg-[#f3e7e8]">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[1px] bg-white/70" />
            <div
              className="absolute top-0 bottom-0 rounded-full bg-[#e7d0d1]"
              style={{ left: `${(r.min / 10) * 100}%`, width: `${((r.max - r.min) / 10) * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -ml-[3px] w-[6px] h-[6px] rounded-full bg-[#7a3d41]"
              style={{ left: `${(r.avg / 10) * 100}%` }}
            />
          </div>
          <div className="w-28 flex justify-between">
            <span>{r.min.toFixed(1)}</span>
            <span className="font-semibold">{r.avg.toFixed(1)}</span>
            <span>{r.max.toFixed(1)}</span>
          </div>
          <div className="w-10 text-right text-[#6b4a4c]">n={r.n}</div>
        </div>
      ))}
    </div>
  );
}

function BoxOfficeBars({ data }: { data: { id: string; title: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.id} className="flex items-center gap-3 text-xs text-[#1b0e0e]">
          <div className="w-64 truncate" title={r.title}>
            {r.title}
          </div>
          <div className="h-2 flex-1 rounded-full bg-[#f3e7e8] overflow-hidden">
            <div className="h-full bg-[#994d51]" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          <div className="w-28 text-right tabular-nums">${(r.value / 1_000_000).toFixed(1)}M</div>
        </div>
      ))}
    </div>
  );
}

function AwardsBars({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const palette: Record<string, string> = {
    Wins: '#7a3d41',
    Nominations: '#994d51',
    'Oscars Won': '#5d2e32',
    'Oscars Nominated': '#b86a70',
  };
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.name} className="flex items-center gap-3 text-xs text-[#1b0e0e]">
          <div className="w-40 truncate" title={r.name}>{r.name}</div>
          <div className="h-2 flex-1 rounded-full bg-[#f3e7e8] overflow-hidden">
            <div className="h-full" style={{ width: `${(r.value / max) * 100}%`, background: palette[r.name] ?? '#994d51' }} />
          </div>
          <div className="w-12 text-right tabular-nums">{r.value}</div>
        </div>
      ))}
    </div>
  );
}
