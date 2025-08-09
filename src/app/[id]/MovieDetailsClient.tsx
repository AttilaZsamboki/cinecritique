"use client";
import Link from "next/link";
import { api } from "~/trpc/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { useMemo, useState } from "react";
import { toYouTubeEmbedUrl } from "~/lib/utils";

export default function MovieDetailsClient({ movieId }: { movieId: string }) {
  // Fetch all data via tRPC
  const { data: movie, isLoading: movieLoading } = api.movie.getById.useQuery({ id: movieId });
  const { data: allCriteria = [], isLoading: criteriaLoading } = api.movie.getAllCriteria.useQuery();
  const { data: evaluations = [] } = api.movie.getEvaluationsByMovie.useQuery({ movieId });
  const evalIds = evaluations.map(e => e.id);
  const { data: scores = [] } = api.movie.getScoresByEvaluationIds.useQuery({ evalIds });
  const { data: bestOfAll = [] } = api.movie.getBestOfForAll.useQuery();

  const utils = api.useUtils();
  const upsertScore = api.movie.upsertEvaluationScore.useMutation({
    onSuccess: () => {
      utils.movie.getScoresByEvaluationIds.invalidate({ evalIds }).catch(() => console.log(""));
    },
  });
  const setBestOf = api.movie.setBestOf.useMutation({
    onSuccess: async () => {
      await utils.movie.getBestOfForAll.invalidate();
    },
  });
  const updatePoster = api.movie.updateMoviePoster.useMutation({
    onSuccess: async () => {
      await utils.movie.getById.invalidate({ id: movieId });
    },
  });

  const [confirm, setConfirm] = useState<{
    criteriaId: string,
    currentBestMovieId?: string,
    currentBestClipUrl?: string,
    clipUrlInput?: string,
  } | null>(null);
  const currentBestByCriteria: Record<string, {movieId: string, clipUrl?: string}> = {};
  for (const b of bestOfAll) {
    if (b.criteriaId && b.movieId) currentBestByCriteria[b.criteriaId] = { movieId: b.movieId, clipUrl: b.clipUrl ?? undefined };
  }

  const criteriaById = useMemo(() => Object.fromEntries(allCriteria.map(c => [c.id, c] as const)), [allCriteria]);
  const currentBestMovieId = confirm?.currentBestMovieId;
  const { data: currentBestMovie } = api.movie.getById.useQuery(
    { id: currentBestMovieId ?? "" },
    { enabled: !!currentBestMovieId }
  );

  // Loading state
  if (movieLoading || criteriaLoading) return <div>Loading...</div>;
  if (!movie) return <div>Not found</div>;

  // Build criteria tree
  const mainCriteria = allCriteria.filter(c => !c.parentId);
  const subCriteria = allCriteria.filter(c => c.parentId);

  // Map: evaluationId -> [score]
  const evalScores: Record<string, {criteriaId: string, score: number}[]> = {};
  scores.forEach(s => {
    if (s.evaluationId) {
      if (!evalScores[s.evaluationId]) evalScores[s.evaluationId] = [];
      evalScores[s.evaluationId]?.push({ criteriaId: s.criteriaId ?? '', score: Number(s.score) });
    }
  });

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
    const stars = [];
    for (let i = 1; i <= 10; i++) {
      const starValue = i * 0.5;
      stars.push(
        <span
          key={starValue}
          style={{ cursor: "pointer", color: value >= starValue ? "#e92932" : "#e7d0d1", fontSize: 24 }}
          onClick={() => onChange(starValue)}
          title={starValue.toString()}
        >
          {starValue % 1 === 0 ? "★" : "☆"}
        </span>
      );
    }
    return <span>{stars}</span>;
  }

  return (
    <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 mb-6">
              <p className="text-[#1b0e0e] tracking-light text-[32px] font-bold leading-tight min-w-72">Review: {movie.title}</p>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="Poster URL"
                  className="h-9 w-72 rounded-xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm px-3 text-sm shadow-sm"
                  defaultValue={movie.posterUrl ?? ""}
                  onBlur={(e) => {
                    const val = e.currentTarget.value.trim();
                    if (!val || val === movie.posterUrl) return;
                    try {
                      new URL(val);
                      updatePoster.mutate({ id: movie.id, posterUrl: val });
                    } catch {}
                  }}
                />
                <button
                  className="h-9 rounded-xl px-3 text-sm bg-[#994d51] text-white shadow-sm hover:bg-[#7a3d41] transition-colors"
                  onClick={async () => {
                    try {
                      const title = movie.title ?? "";
                      const year = String(movie.year ?? "");
                      if (!title) return;
                      const res = await fetch(`/api/omdb?t=${encodeURIComponent(title)}${year ? `&y=${encodeURIComponent(year)}` : ''}`);
                      const data = (await res.json()) as unknown as { Poster?: string };
                      if (data?.Poster && data.Poster !== 'N/A') {
                        updatePoster.mutate({ id: movie.id, posterUrl: data.Poster });
                      }
                    } catch { /* noop */ }
                  }}
                >Fetch Poster</button>
              </div>
            </div>
            <div className="@container">
              <div className="relative flex w-full flex-col items-start justify-between gap-3 p-4 @[480px]:flex-row @[480px]:items-center bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-sm">
                <div className="flex w-full shrink-[3] items-center justify-between">
                  <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em]">Overall Score</h3>
                  <p className="text-[#1b0e0e] text-sm font-normal leading-normal @[480px]:hidden">{overall ?? '-'}</p>
                </div>
                <div className="flex h-4 w-full items-center gap-4">
                  <div className="flex h-2 flex-1 rounded-full bg-[#e7d0d1]">
                    <div className="h-full rounded-full bg-[#994d51]" style={{ width: `${overall !== undefined ? overall * 20 : 0}%` }}></div>
                    <div className="relative"><div className="absolute -left-2 -top-1.5 size-4 rounded-full bg-[#994d51]"></div></div>
                  </div>
                  <p className="text-[#1b0e0e] text-sm font-normal leading-normal hidden @[480px]:block">{overall ?? '-'}</p>
                </div>
              </div>
            </div>
            {mainCriteria.sort((a, b) => (b.weight??0) - (a.weight ??0)).map(main => (
              <div key={main.id}>
                <div className="@container">
                  <div className="relative flex w-full flex-col items-start justify-between gap-3 p-4 @[480px]:flex-row @[480px]:items-center bg-white/80 backdrop-blur-sm border border-white/20 rounded-2xl shadow-sm">
                    <div className="flex w-full shrink-[3] items-center justify-between">
                      <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em]">{main.name}</h3>
                      <p className="text-[#1b0e0e] text-sm font-normal leading-normal @[480px]:hidden">{mainValues[main.id] !== undefined ? mainValues[main.id] : '-'}</p>
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
                      <div className="flex w-full shrink-[3] items-center justify-between">
                        <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="text-[#1b0e0e] cursor-pointer text-base font-medium leading-normal">{sub.name}</p>
                            </TooltipTrigger>
                            <TooltipContent >
                              {sub.description}
                            </TooltipContent>
                        </Tooltip>
                        <div className="flex items-center gap-2">
                          <StarInput value={subAverages[sub.id] ?? 0} onChange={v => upsertScore.mutate({ movieId: movie.id, criteriaId: sub.id, score: v })} />
                          <span className="text-[#1b0e0e] text-sm font-normal leading-normal">{subAverages[sub.id] ?? '-'}</span>
                          <button
                            onClick={() => {
                              const current = currentBestByCriteria[sub.id];
                              setConfirm({ 
                                criteriaId: sub.id,
                                currentBestMovieId: current?.movieId,
                                currentBestClipUrl: current?.clipUrl,
                              });
                            }}
                            className="ml-3 rounded-lg px-2.5 py-1.5 text-xs bg-[#f3e7e8] text-[#1b0e0e] font-medium hover:bg-[#e7d0d1] transition-colors"
                          >
                            Make Best
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-2 sm:px-4 pb-2 pt-4">Notes</h3>
            <div className="flex max-w-[640px] flex-wrap items-end gap-4 px-2 sm:px-4 py-3">
              <label className="flex flex-col min-w-40 flex-1">
                <textarea
                  placeholder="Enter your notes here..."
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-2xl text-[#1b0e0e] focus:outline-0 focus:ring-0 border border-[#e7d0d1] bg-white/80 backdrop-blur-sm focus:border-[#e7d0d1] min-h-36 placeholder:text-[#994d51] p-[15px] text-base font-normal leading-normal shadow-sm"
                ></textarea>
              </label>
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
            <h4 className="text-lg font-bold mb-2">Confirm Best-in-Category</h4>
            {(() => {
              const best = currentBestByCriteria[confirm.criteriaId];
              const subName = criteriaById[confirm.criteriaId]?.name ?? "this category";
              if (!best) return (
                <>
                  <p className="text-sm text-[#1b0e0e] mb-3">Are you sure you think {movie.title} has the best {subName}? This will set the first title holder.</p>
                </>
              );
              return (
                <div className="mb-3">
                  <p className="text-sm text-[#1b0e0e] mb-2">Are you sure you think {movie.title} has better {subName} than {currentBestMovie?.title ?? "the current holder"}?</p>
                  {confirm.currentBestClipUrl ? (() => {
                    const yt = toYouTubeEmbedUrl(confirm.currentBestClipUrl);
                    return yt ? (
                      <iframe className="w-full rounded-xl shadow-sm" src={yt} title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                    ) : (
                      <video className="w-full rounded-xl shadow-sm" controls src={`/api/video-proxy?url=${encodeURIComponent(confirm.currentBestClipUrl)}`} />
                    );
                  })() : null}
                </div>
              );
            })()}
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
                  setBestOf.mutate({ criteriaId: confirm.criteriaId, movieId: movie.id, clipUrl: confirm.clipUrlInput });
                  setConfirm(null);
                }}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 