"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { useMemo, useState, type JSX, useEffect } from "react";
import { toYouTubeEmbedUrl } from "~/lib/utils";
import CardActions from "../_components/CardActions";
import UserNotes from "../_components/UserNotes";
import { toast } from "~/components/ui/toast";

export default function MovieDetailsClient({ movieId }: { movieId: string }) {
  const router = useRouter();
  // Fetch all data via tRPC
  const { data: movie, isLoading: movieLoading } = api.movie.getById.useQuery({ id: movieId });
  const { data: allCriteria = [], isLoading: criteriaLoading } = api.movie.getAllCriteria.useQuery();
  const { data: applicable = [], isLoading: applicableLoading } = api.movie.getApplicableCriteriaForMovie.useQuery({ movieId });
  const { data: evaluations = [] } = api.movie.getEvaluationsByMovie.useQuery({ movieId });
  const evalIds = evaluations.map(e => e.id);
  const { data: scores = [] } = api.movie.getScoresByEvaluationIds.useQuery({ evalIds });
  const { data: bestOfAll = [] } = api.movie.getBestOfForAll.useQuery();
  const utils = api.useUtils();
  const fetchMovieData = api.omdb.getByTitle.useMutation({
    onSuccess: async () => {
      await utils.movie.getById.invalidate({ id: movieId });
      toast({ kind: "success", message: "Poster fetched and updated." });
    },
    onError: () => {
      toast({ kind: "error", message: "Failed to fetch poster." });
    },
  })
  const upsertScore = api.movie.upsertEvaluationScore.useMutation({
    onSuccess: () => {
      utils.movie.getScoresByEvaluationIds.invalidate({ evalIds }).catch(() => {});
      toast({ kind: "success", message: "Score saved." });
    },
    onError: () => {
      toast({ kind: "error", message: "Failed to save score." });
    },
  });
  const addToCurated = api.movie.addToBestOfList.useMutation({
    onSuccess: async () => {
      await utils.movie.getBestOfForAll.invalidate();
      toast({ kind: "success", message: "Added to curated list." });
    },
    onError: () => {
      toast({ kind: "error", message: "Failed to add to curated list." });
    },
  });
  const updatePoster = api.movie.updateMoviePoster.useMutation({
    onSuccess: async () => {
      await utils.movie.getById.invalidate({ id: movieId });
      toast({ kind: "success", message: "Poster updated." });
    },
    onError: () => {
      toast({ kind: "error", message: "Poster update failed." });
    },
  });

  const deleteMovie = api.movie.deleteMovieForce.useMutation({
    onSuccess: async () => {
      // Ensure caches clear and navigate home
      await utils.movie.getById.invalidate({ id: movieId });
      router.push("/");
      toast({ kind: "success", message: "Movie deleted." });
    },
    onError: () => {
      toast({ kind: "error", message: "Failed to delete movie." });
    },
  });

  const [confirm, setConfirm] = useState<{
    criteriaId: string,
    clipUrlInput?: string,
  } | null>(null);
  // Optimistic per-sub-criteria average override for snappier star input
  const [localSubAvg, setLocalSubAvg] = useState<Record<string, number | undefined>>({});
  // Collapsible overrides panel per main criteria
  const [openOverrides, setOpenOverrides] = useState<Set<string>>(new Set());
  const currentBestByCriteria: Record<string, {movieId: string, clipUrl?: string}> = {};
  for (const b of bestOfAll) {
    if (b.criteriaId && b.movieId) currentBestByCriteria[b.criteriaId] = { movieId: b.movieId, clipUrl: b.clipUrl ?? undefined };
  }

  // For this movie, collect curated entries keyed by sub-criteria id
  const curatedForThisMovie = useMemo(() => {
    const m = new Map<string, { position?: number; clipUrl?: string }>();
    for (const b of bestOfAll) {
      if (b.movieId === movieId && b.criteriaId) {
        m.set(b.criteriaId, { position: b.position ?? undefined, clipUrl: b.clipUrl ?? undefined });
      }
    }
    return m;
  }, [bestOfAll, movieId]);

  // Minimal editor to include/exclude/inherit sub-criteria for this movie
  function OverridesEditor({ criterias, applicableIds, movieId, parentId }: { criterias: typeof allCriteria; applicableIds: Set<string | undefined>; movieId: string, parentId?: string }) {
    const subs = criterias.filter(c => c.parentId && (!parentId || c.parentId === parentId));
    const [q, setQ] = useState("");
    const { data: overrides = [], refetch } = api.movie.getMovieCriteriaOverrides.useQuery({ movieId });
    // Local optimistic state keyed by criteriaId -> Mode | undefined
    const [optimistic, setOptimistic] = useState<Record<string, 'inherit' | 'include' | 'exclude' | undefined>>({});
    const setOverride = api.movie.setMovieCriteriaOverride.useMutation({
      onSuccess: async () => {
        await Promise.all([
          refetch(),
          utils.movie.getApplicableCriteriaForMovie.invalidate({ movieId }),
        ]);
        toast({ kind: 'success', message: 'Override saved.' });
      },
      onError: (_e, vars) => {
        if (vars?.criteriaId) setOptimistic((p) => ({ ...p, [vars.criteriaId]: undefined }));
        toast({ kind: 'error', message: 'Failed to save override.' });
      }
    });
    const clearOverride = api.movie.clearMovieCriteriaOverride.useMutation({
      onSuccess: async () => {
        await Promise.all([
          refetch(),
          utils.movie.getApplicableCriteriaForMovie.invalidate({ movieId }),
        ]);
        toast({ kind: 'success', message: 'Override cleared.' });
      },
      onError: (_e, vars) => {
        if (vars?.criteriaId) setOptimistic((p) => ({ ...p, [vars.criteriaId]: undefined }));
        toast({ kind: 'error', message: 'Failed to clear override.' });
      }
    });

    type Mode = 'inherit' | 'include' | 'exclude';
    const isMode = (v: unknown): v is Mode => v === 'inherit' || v === 'include' || v === 'exclude';

    const overrideMap = new Map(overrides.map(o => [o.criteriaId, o.mode] as const));

    const filtered = subs.filter(sc => (sc.name ?? "").toLowerCase().includes(q.toLowerCase()));

    // Track hovered row to enable quick keyboard actions without focus juggling
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!hoveredId) return;
        if (e.key.toLowerCase() === 'i') {
          e.preventDefault();
          setOptimistic(p => ({ ...p, [hoveredId]: 'include' }));
          setOverride.mutate({ movieId, criteriaId: hoveredId, mode: 'include' });
        } else if (e.key.toLowerCase() === 'e') {
          e.preventDefault();
          setOptimistic(p => ({ ...p, [hoveredId]: 'exclude' }));
          setOverride.mutate({ movieId, criteriaId: hoveredId, mode: 'exclude' });
        } else if (e.key.toLowerCase() === 'r' || e.key === 'Backspace') {
          e.preventDefault();
          setOptimistic(p => ({ ...p, [hoveredId]: 'inherit' }));
          clearOverride.mutate({ movieId, criteriaId: hoveredId });
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [hoveredId, movieId]);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            className="w-full rounded-xl border border-[#e7d0d1] bg-white px-3 py-2 text-sm text-[#1b0e0e]"
            placeholder="Search criteria in this section..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="text-xs text-[#6b4a4c] -mt-1">Tip: Hover a row and press I to Include, E to Exclude, R to Inherit.</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map(sc => {
          const id = sc.id;
          const effIncluded = applicableIds.has(id);
          const ov = optimistic[id] ?? overrideMap.get(id);
          const state: Mode = isMode(ov) ? ov : 'inherit';
          return (
            <div key={id} className="flex items-center justify-between border border-[#e7d0d1] rounded-xl px-3 py-2 bg-white/80"
              onMouseEnter={() => setHoveredId(id)}
              onMouseLeave={() => setHoveredId(current => current === id ? null : current)}
            >
              <div className="text-sm text-[#1b0e0e] mr-3 min-w-0 flex-1">
                <div className="font-medium truncate flex items-center gap-2">
                  <span className="truncate">{sc.name}</span>
                  {state !== 'inherit' && (
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${state==='include' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {state}
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-70">Effective: {effIncluded ? 'Included' : 'Excluded'}</div>
              </div>
              <div className="flex items-center gap-1 bg-white rounded-lg border border-[#e7d0d1] p-0.5">
                <button
                  className={`px-2 py-1 rounded-md text-xs ${state==='inherit' ? 'bg-[#f3e7e8] text-[#1b0e0e]' : 'text-[#6b4a4c]'}`}
                  onClick={() => {
                    setOptimistic(p => ({ ...p, [id]: 'inherit' }));
                    clearOverride.mutate({ movieId, criteriaId: id });
                  }}
                  title="Inherit"
                >Inherit</button>
                <button
                  className={`px-2 py-1 rounded-md text-xs ${state==='include' ? 'bg-[#e6f6ef] text-[#135c36]' : 'text-[#6b4a4c]'}`}
                  onClick={() => {
                    setOptimistic(p => ({ ...p, [id]: 'include' }));
                    setOverride.mutate({ movieId, criteriaId: id, mode: 'include' });
                  }}
                  title="Include"
                >Include</button>
                <button
                  className={`px-2 py-1 rounded-md text-xs ${state==='exclude' ? 'bg-[#fde8ea] text-[#7a1f27]' : 'text-[#6b4a4c]'}`}
                  onClick={() => {
                    setOptimistic(p => ({ ...p, [id]: 'exclude' }));
                    setOverride.mutate({ movieId, criteriaId: id, mode: 'exclude' });
                  }}
                  title="Exclude"
                >Exclude</button>
              </div>
            </div>
          );
        })}
        </div>
      </div>
    );
  }

  const criteriaById = useMemo(() => Object.fromEntries(allCriteria.map(c => [c.id, c] as const)), [allCriteria]);
  // No need to fetch current holder; we now allow multiple curated per criteria

  // Loading state

  // Build criteria tree
  const applicableIds = new Set(applicable.map(c => c.id));
  const mainCriteria = allCriteria.filter(c => !c.parentId && applicableIds.has(c.id));
  const subCriteria = allCriteria.filter(c => c.parentId && applicableIds.has(c.id));

  // Map: evaluationId -> [score]
  const evalScores: Record<string, {criteriaId: string, score: number}[]> = {};
  scores.forEach(s => {
    if (s.evaluationId) {
      if (!evalScores[s.evaluationId]) evalScores[s.evaluationId] = [];
      evalScores[s.evaluationId]?.push({ criteriaId: s.criteriaId ?? '', score: Number(s.score) });
    }
  });

  // Movie meta editor (type/genre)
  const [typeInput, setTypeInput] = useState<string>(movie?.type ?? "");
  const [genreInput, setGenreInput] = useState<string>(movie?.genre ?? "");
  const updateMeta = api.movie.updateMovieMeta.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.movie.getById.invalidate({ id: movieId }),
        utils.movie.getApplicableCriteriaForMovie.invalidate({ movieId }),
      ]);
      toast({ kind: "success", message: "Movie meta saved." });
    },
    onError: () => {
      toast({ kind: "error", message: "Failed to save movie meta." });
    },
  });

  if (movieLoading || criteriaLoading || applicableLoading) return <div>Loading...</div>;
  if (!movie) return <div>Not found</div>;

  // For each sub-criteria, calculate average score
  const subAverages: Record<string, number> = {};
  for (const sub of subCriteria) {
    const subScores: number[] = [];
    for (const evalId of evalIds) {
      const scoresForEval = evalScores[evalId] || [];
      const found = scoresForEval.find(s => s.criteriaId === sub.id);
      if (found) subScores.push(found.score);
    }
    if (subScores.length > 0) {
      subAverages[sub.id] = Math.round((subScores.reduce((a, b) => a + b, 0) / subScores.length) * 10) / 10;
    }
  }

  // For each main-criteria, calculate weighted value from sub-criteria
  const mainValues: Record<string, number> = {};
  for (const main of mainCriteria) {
    const subs = subCriteria.filter(sc => sc.parentId === main.id);
    let subWeightedSum = 0;
    let subTotalWeight = 0;
    for (const sub of subs) {
      if (subAverages[sub.id] !== undefined && sub.weight) {
        subWeightedSum += (subAverages[sub.id] ?? 0) * sub.weight;
        subTotalWeight += sub.weight;
      }
    }
    if (subTotalWeight > 0) {
      mainValues[main.id] = Math.round((subWeightedSum / subTotalWeight) * 10) / 10;
    }
  }

  // Calculate overall weighted score
  let weightedSum = 0;
  let totalWeight = 0;
  for (const main of mainCriteria) {
    if (mainValues[main.id] !== undefined && main.weight) {
      weightedSum += (mainValues[main.id] ?? 0) * main.weight;
      totalWeight += main.weight;
    }
  }
  const overall = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : undefined;

  // Add mutation for updating score

  // For each sub-criteria, render stars and handle click
  function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    // 0.5 increments, 5 stars
    const buttons = [] as JSX.Element[];
    for (let i = 1; i <= 10; i++) {
      const v = i * 0.5;
      const active = value >= v;
      buttons.push(
        <button
          key={v}
          type="button"
          className={`transition-colors`}
          aria-label={`${v} stars`}
          onClick={() => onChange(v)}
          style={{ color: active ? "#e92932" : "#e7d0d1", fontSize: 22, lineHeight: 1 }}
        >
          {v % 1 === 0 ? "★" : "☆"}
        </button>
      );
    }
    return <div className="inline-flex items-center gap-0.5">{buttons}</div>;
  }

  // Guided scoring mode: follow the same visual order (main criteria by weight desc, then their subs as rendered)
  const orderedSubIds = useMemo(() => {
    const order: string[] = [];
    const mains = [...mainCriteria].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    for (const main of mains) {
      const subs = subCriteria.filter(sc => sc.parentId === main.id);
      for (const s of subs) order.push(s.id as string);
    }
    return order;
  }, [mainCriteria, subCriteria]);
  const [guided, setGuided] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const currentSubId = orderedSubIds[currentIdx];
  const currentSub = currentSubId ? criteriaById[currentSubId] : undefined;

  const adjustScore = (delta: number) => {
    const id = currentSubId;
    if (!id) return;
    const cur = localSubAvg[id] ?? (subAverages[id] ?? 0);
    const next = Math.max(0, Math.min(5, cur + delta));
    setLocalSubAvg(prev => ({ ...prev, [id]: next }));
    upsertScore.mutate({ movieId: movie.id, criteriaId: id, score: next });
  };

  useEffect(() => {
    if (!guided) return;
    const onKey = (e: KeyboardEvent) => {
      // Number keys 1..5 map to whole stars 1..5
      const key = e.key;
      if (key >= '1' && key <= '5') {
        e.preventDefault();
        const id = currentSubId;
        if (!id) return;
        const v = Number(key);
        setLocalSubAvg(prev => ({ ...prev, [id]: v }));
        upsertScore.mutate({ movieId: movie.id, criteriaId: id, score: v });
        setCurrentIdx(i => Math.min(i + 1, orderedSubIds.length - 1));
        return;
      }
      if (key === 'ArrowRight') { e.preventDefault(); setCurrentIdx(i => Math.min(i + 1, orderedSubIds.length - 1)); return; }
      if (key === 'ArrowLeft') { e.preventDefault(); setCurrentIdx(i => Math.max(i - 1, 0)); return; }
      if (key === 'ArrowUp') { e.preventDefault(); adjustScore(0.5); return; }
      if (key === 'ArrowDown') { e.preventDefault(); adjustScore(-0.5); return; }
      if (key === 'Enter' || key === ' ') { e.preventDefault(); setCurrentIdx(i => Math.min(i + 1, orderedSubIds.length - 1)); return; }
      if (key.toLowerCase() === 'g') { e.preventDefault(); setGuided(false); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guided, currentSubId, orderedSubIds.length, movie.id]);

  return (
    <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/60 rounded-2xl border border-white/20 shadow-sm mb-4">
              <p className="text-[#1b0e0e] text-2xl font-bold leading-tight">Edit: {movie.title}</p>
              <div className="flex items-center gap-3">
                <CardActions movieId={movie.id} />
                <input
                  type="url"
                  placeholder="Poster URL"
                  className="h-9 w-64 rounded-xl border border-[#e7d0d1] bg-white/80 px-3 text-sm shadow-sm"
                  defaultValue={movie.posterUrl ?? ""}
                  onBlur={(e) => {
                    const val = e.currentTarget.value.trim();
                    if (!val || val === movie.posterUrl) return;
                    try { new URL(val); updatePoster.mutate({ id: movie.id, posterUrl: val }); } catch {}
                  }}
                />
                <button
                  className="h-9 rounded-xl px-3 text-sm bg-[#994d51] text-white shadow-sm hover:bg-[#7a3d41]"
                  onClick={() => {
                    const title = movie.title ?? "";
                    const year = String(movie.year ?? "");
                    if (!title) return;
                    fetchMovieData.mutate({ title, year });
                  }}
                >Fetch Poster</button>
                <button
                  className="h-9 rounded-xl px-3 text-sm bg-[#e92932] text-white shadow-sm hover:bg-[#c61f27]"
                  onClick={() => {
                    if (window.confirm("Delete this movie and all related ratings? This cannot be undone.")) {
                      deleteMovie.mutate({ id: movie.id });
                    }
                  }}
                  disabled={deleteMovie.isPending}
                  title="Delete movie"
                >Delete</button>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-white/70 border border-white/20 rounded-2xl shadow-sm">
              <h3 className="text-[#1b0e0e] text-base font-semibold">Overall Score</h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f3e7e8] px-2.5 py-1 text-sm text-[#1b0e0e]">
                <span>★</span>
                <span className="font-semibold">{overall ?? '-'}</span>
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  className={`h-8 rounded-xl px-3 text-xs shadow-sm border border-[#e7d0d1] ${guided ? 'bg-[#994d51] text-white' : 'bg-white text-[#1b0e0e]'}`}
                  onClick={() => { setGuided(g => !g); if (!guided) setCurrentIdx(0); }}
                  title="Toggle Guided Mode (G)"
                >{guided ? 'Guided: On' : 'Guided: Off'}</button>
                <span className="hidden sm:block text-[11px] text-[#6b4a4c]">Keys: 1–5 stars, ←/→ prev/next, ↑/↓ ±0.5, Enter next, G toggle</span>
              </div>
            </div>
            {/* Radar chart of main criteria */}
            {Object.keys(mainValues).length > 0 && (
              <div className="mt-3 p-4 bg-white/70 border border-white/20 rounded-2xl shadow-sm">
                <h4 className="text-[#1b0e0e] text-sm font-semibold mb-2">Criteria Radar</h4>
                {(() => {
                  const entries = mainCriteria.map(m => ({ id: m.id as string, name: m.name as string, v: mainValues[m.id] ?? 0 }));
                  const N = entries.length;
                  const size = 220; const r = 90; const cx = 120; const cy = 120;
                  const toPoint = (idx: number, value01: number) => {
                    const ang = (Math.PI * 2 * idx) / N - Math.PI / 2;
                    const rr = r * value01;
                    return { x: cx + rr * Math.cos(ang), y: cy + rr * Math.sin(ang) };
                  };
                  const points = entries.map((e, i) => {
                    const v01 = Math.max(0, Math.min(1, (e.v ?? 0) / 5));
                    return toPoint(i, v01);
                  });
                  const polygon = points.map(p => `${p.x},${p.y}`).join(" ");
                  const axes = entries.map((_, i) => {
                    const p = toPoint(i, 1);
                    return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e7d0d1" strokeWidth={1} />
                  });
                  const rings = [0.25, 0.5, 0.75, 1].map((f, i) => (
                    <circle key={i} cx={cx} cy={cy} r={r * f} fill="none" stroke="#f3e7e8" strokeDasharray="4 4" />
                  ));
                  return (
                    <div className="flex items-center gap-4">
                      <svg width={size} height={size} className="shrink-0">
                        {rings}
                        {axes}
                        <polygon points={polygon} fill="#994d51" fillOpacity={0.25} stroke="#994d51" strokeWidth={2} />
                        {points.map((p, i) => (
                          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#7a3d41" />
                        ))}
                      </svg>
                      <div className="grid grid-cols-2 gap-1 text-xs text-[#1b0e0e]">
                        {entries.map((e, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="inline-block size-2 rounded-full" style={{ background: i % 2 === 0 ? '#994d51' : '#7a3d41' }} />
                            <span className="truncate max-w-[160px]" title={`${e.name}: ${e.v?.toFixed?.(1) ?? e.v}`}>{e.name}</span>
                            <span className="ml-auto font-semibold">{(e.v ?? 0).toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {/* Movie meta inline editor and applicable count */}
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/60 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[#1b0e0e]">Applicable criteria: <span className="font-semibold">{applicable.length}</span></div>
                <div className="text-xs text-[#6b4a4c]">Edit movie meta to affect applicability</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e]"
                  placeholder="Type (e.g., animation, documentary)"
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                />
                <input
                  className="rounded-xl border border-[#e7d0d1] bg-white px-3 py-1 text-sm text-[#1b0e0e] min-w-[280px] flex-1"
                  placeholder="Genres CSV (e.g., animation,comedy)"
                  value={genreInput}
                  onChange={(e) => setGenreInput(e.target.value)}
                />
                <button
                  className="rounded-xl bg-[#994d51] px-3 py-1 text-sm text-white hover:bg-[#7a3d41]"
                  onClick={() => updateMeta.mutate({ id: movie.id, type: typeInput || null, genre: genreInput || null })}
                  disabled={updateMeta.isPending}
                >Save</button>
              </div>
            </div>

            {mainCriteria.sort((a, b) => (b.weight??0) - (a.weight ??0)).map(main => (
              <div key={main.id}>
                <div className="@container">
                  <div className="relative flex w-full flex-col items-start justify-between gap-3 p-4 @[480px]:flex-row @[480px]:items-center bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-sm">
                    <div className="flex w-full shrink-[3] items-center justify-between">
                      <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em]">{main.name}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-[#1b0e0e] text-sm font-normal leading-normal @[480px]:hidden">{mainValues[main.id] !== undefined ? mainValues[main.id] : '-'}</p>
                        <button
                          className="text-xs px-2 py-1 rounded-lg border border-[#e7d0d1] bg-white hover:bg-[#f3e7e8]"
                          onClick={() => {
                            const s = new Set(openOverrides);
                            if (s.has(main.id)) s.delete(main.id); else s.add(main.id);
                            setOpenOverrides(s);
                          }}
                        >
                          {openOverrides.has(main.id) ? 'Hide' : 'Show'} Applicability
                        </button>
                      </div>
                    </div>
                    <div className="flex h-4 w-full items-center gap-4">
                      <div className="flex h-2 flex-1 rounded-full bg-[#e7d0d1]">
                        <div className="h-full rounded-full bg-[#994d51]" style={{ width: `${mainValues[main.id] !== undefined ? (mainValues[main.id] ?? 0) * 20 : 0}%` }}></div>
                        <div className="relative"><div className="absolute -left-2 -top-1.5 size-4 rounded-full bg-[#994d51]"></div></div>
                      </div>
                      <p className="text-[#1b0e0e] text-sm font-normal leading-normal hidden @[480px]:block">{mainValues[main.id] !== undefined ? mainValues[main.id] : '-'}</p>
                    </div>
                  </div>
                </div>
                {subCriteria.filter(sc => sc.parentId === main.id).map(sub => (
                  <div className="@container" key={sub.id}>
                    <div className="relative flex w-full flex-col items-start justify-between gap-3 p-4 @[480px]:flex-row @[480px]:items-center">
                      <div className={`flex w-full shrink-[3] items-center justify-between rounded-xl ${guided && currentSubId === sub.id ? 'ring-2 ring-[#994d51] ring-offset-2 ring-offset-white/60' : ''}`}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-[#1b0e0e] cursor-pointer text-base font-medium leading-normal">{sub.name}</p>
                            </TooltipTrigger>
                            <TooltipContent >
                              {sub.description}
                            </TooltipContent>
                        </Tooltip>
                        <div className="flex items-center gap-2">
                          <StarInput
                            value={localSubAvg[sub.id] ?? (subAverages[sub.id] ?? 0)}
                            onChange={(v) => {
                              setLocalSubAvg((prev) => ({ ...prev, [sub.id]: v }));
                              upsertScore.mutate({ movieId: movie.id, criteriaId: sub.id, score: v });
                              if (guided && currentSubId === sub.id) {
                                setCurrentIdx(i => Math.min(i + 1, orderedSubIds.length - 1));
                              }
                            }}
                          />
                          <span className="text-[#1b0e0e] text-sm font-normal leading-normal">{(localSubAvg[sub.id] ?? subAverages[sub.id]) ?? '-'}</span>
                          {(() => {
                            const entry = curatedForThisMovie.get(sub.id);
                            if (entry) {
                              return (
                                <span className="ml-3 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  ✓ In Top{typeof entry.position === 'number' ? ` #${entry.position+1}` : ''}
                                </span>
                              );
                            }
                            return (
                              <button
                                onClick={() => {
                                  setConfirm({ 
                                    criteriaId: sub.id,
                                  });
                                }}
                                className="ml-3 rounded-lg px-2.5 py-1.5 text-xs bg-[#f3e7e8] text-[#1b0e0e] font-medium hover:bg-[#e7d0d1] transition-colors"
                              >
                                Add to Curated
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {openOverrides.has(main.id) && (
                  <div className="mt-3 p-4 bg-white/60 rounded-2xl border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[#1b0e0e] text-base font-semibold">Criteria Applicability</h4>
                      <span className="text-xs text-[#6b4a4c]">{subCriteria.filter(sc => sc.parentId === main.id).length} items</span>
                    </div>
                    <OverridesEditor
                      criterias={allCriteria}
                      applicableIds={applicableIds}
                      movieId={movie.id}
                      parentId={main.id}
                    />
                  </div>
                )}
              </div>
            ))}
            <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-2 sm:px-4 pb-2 pt-4">Notes</h3>
            <div className="px-2 sm:px-4 py-3 max-w-[840px]">
              <UserNotes movieId={movie.id} />
            </div>
            <div className="flex px-2 sm:px-4 py-3 justify-end">
              <button
                className="flex min-w-[120px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-xl h-10 px-4 bg-[#e92932] hover:bg-[#c61f27] text-white text-sm font-bold leading-normal tracking-[0.015em] shadow-sm"
              >
                <Link href="/">
                  <span className="truncate">Submit Review</span>
                </Link>
              </button>
            </div>
          </div>
        </div>
      </div>
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[520px] rounded-2xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-bold mb-2">Add to Curated</h4>
            <p className="text-sm text-[#1b0e0e] mb-3">This will add <strong>{movie.title}</strong> to the curated top list for <strong>{criteriaById[confirm.criteriaId]?.name ?? "this category"}</strong>.</p>
            <div className="mb-3">
              <label className="block text-sm mb-1 text-[#1b0e0e]">Optional: YouTube URL (supports watch/shorts/embed/yt.be)</label>
              <input
                className="w-full rounded-xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm px-3 py-2 text-sm shadow-sm"
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                value={confirm.clipUrlInput ?? ""}
                onChange={(e) => setConfirm({ ...confirm, clipUrlInput: e.target.value })}
              />
              {confirm.clipUrlInput ? (
                (() => {
                  const embed = toYouTubeEmbedUrl(confirm.clipUrlInput);
                  return embed ? (
                    <div className="mt-2">
                      <iframe
                        className="w-full aspect-video rounded-xl shadow-sm"
                        src={embed}
                        title="YouTube video preview"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : null;
                })()
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 rounded-xl bg-[#f3e7e8] hover:bg-[#e7d0d1] transition-colors" onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className="px-3 py-2 rounded-xl bg-[#e92932] hover:bg-[#c61f27] text-white shadow-sm"
                onClick={() => {
                  if (!confirm) return;
                  addToCurated.mutate({ criteriaId: confirm.criteriaId, movieId: movie.id, clipUrl: confirm.clipUrlInput });
                  setConfirm(null);
                }}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
      {guided && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="rounded-2xl bg-white/90 backdrop-blur-md border border-[#e7d0d1] shadow-lg px-4 py-2 flex items-center gap-3 text-[#1b0e0e]">
            <span className="text-sm font-medium">Guided Scoring</span>
            {currentSub?.name ? (
              <span className="max-w-[240px] truncate text-xs opacity-80" title={currentSub.name}>{currentSub.name}</span>
            ) : null}
            <span className="text-xs text-[#6b4a4c]">{currentIdx + 1} / {orderedSubIds.length}</span>
            <div className="w-40 h-1.5 bg-[#f3e7e8] rounded-full overflow-hidden">
              <div className="h-full bg-[#994d51]" style={{ width: `${orderedSubIds.length ? ((currentIdx+1)/orderedSubIds.length)*100 : 0}%` }} />
            </div>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#6b4a4c]">
              <span>1–5: set</span>
              <span>↑/↓: ±0.5</span>
              <span>←/→: nav</span>
              <span>Enter: next</span>
              <span>G: exit</span>
            </div>
            <button
              className="ml-2 h-7 rounded-xl px-2 text-xs border border-[#e7d0d1] bg-white hover:bg-[#f8f3f4]"
              onClick={() => setGuided(false)}
            >Exit</button>
          </div>
        </div>
      )}
    </div>
  );
}