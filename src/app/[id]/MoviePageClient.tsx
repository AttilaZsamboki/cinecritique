"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import MovieDetailsClient from "./MovieDetailsClient";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row gap-2 text-sm p-3 rounded-xl bg-white/30 border border-white/20 transition-all duration-300 hover:bg-white/50 hover:shadow-sm">
      <div className="text-[#6b4a4c] font-semibold min-w-24">{label}:</div>
      <div className="text-[#1b0e0e] font-medium">{value}</div>
    </div>
  );
}

export default function MoviePageClient({ movieId }: { movieId: string }) {
  const [tab, setTab] = useState<"details" | "edit">("details");
  const { data: mv, isLoading } = api.movie.getById.useQuery({ id: movieId });
  // Fetch criteria basics to compute overall for Details view
  const { data: allCriteria = [] } = api.movie.getAllCriteria.useQuery();
  const { data: applicable = [] } = api.movie.getApplicableCriteriaForMovie.useQuery({ movieId });
  const { data: evaluations = [] } = api.movie.getEvaluationsByMovie.useQuery({ movieId });
  const evalIds = evaluations.map(e => e.id);
  const { data: scores = [] } = api.movie.getScoresByEvaluationIds.useQuery({ evalIds });

  // Compute overall similar to editor
  const applicableIds = new Set(applicable.map(c => c.id));
  const mainCriteria = allCriteria.filter(c => !c.parentId && applicableIds.has(c.id));
  const subCriteria = allCriteria.filter(c => c.parentId && applicableIds.has(c.id));
  const evalScores: Record<string, {criteriaId: string, score: number}[]> = {};
  scores.forEach(s => {
    if (s.evaluationId) {
      if (!evalScores[s.evaluationId]) evalScores[s.evaluationId] = [];
      evalScores[s.evaluationId]?.push({ criteriaId: s.criteriaId ?? '', score: Number(s.score) });
    }
  });
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
  let weightedSum = 0;
  let totalWeight = 0;
  for (const main of mainCriteria) {
    if (mainValues[main.id] !== undefined && main.weight) {
      weightedSum += (mainValues[main.id] ?? 0) * main.weight;
      totalWeight += main.weight;
    }
  }
  const overall = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : undefined;

  return (
    <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 p-6 glass-strong rounded-2xl border border-white/30 shadow-elegant-lg mb-6">
              <h1 className="gradient-text tracking-tight text-3xl sm:text-4xl font-bold leading-tight break-words">{mv?.title ?? "Movie"}</h1>
              <div className="glass rounded-2xl overflow-hidden shadow-elegant">
                <button
                  className={`px-6 py-3 text-sm font-semibold transition-all duration-300 relative overflow-hidden group ${tab === 'details' ? 'bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white shadow-elegant' : 'text-[#6b4a4c] hover:text-[#994d51] hover:bg-white/60 hover:scale-105'}`}
                  onClick={() => setTab("details")}
                >
                  {tab !== 'details' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#994d51]/10 to-[#7a3d41]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    📋 Details
                  </span>
                </button>
                <button
                  className={`px-6 py-3 text-sm font-semibold transition-all duration-300 relative overflow-hidden group ${tab === 'edit' ? 'bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white shadow-elegant' : 'text-[#6b4a4c] hover:text-[#994d51] hover:bg-white/60 hover:scale-105'}`}
                  onClick={() => setTab("edit")}
                >
                  {tab !== 'edit' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-[#994d51]/10 to-[#7a3d41]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    ✏️ Edit
                  </span>
                </button>
              </div>
            </div>

            {isLoading && <div className="text-sm text-[#1b0e0e]">Loading...</div>}

            {!isLoading && mv && tab === "details" && (
              <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
                <div className="glass-strong rounded-2xl overflow-hidden border border-white/30 shadow-elegant-lg animate-float">
                  <div className="aspect-[2/3] bg-gradient-to-br from-[#f3e7e8] to-[#e7d0d1] flex items-center justify-center relative overflow-hidden">
                    {mv.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mv.posterUrl} alt={mv.title ?? ''} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                    ) : (
                      <div className="text-[#994d51] text-6xl">
                        🎬
                        <div className="text-sm font-medium mt-4 text-[#6b4a4c]">No Poster Available</div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                  </div>
                </div>
                <div className="flex flex-col gap-6 min-w-0">
                  <div className="glass-strong rounded-2xl p-6 border border-white/30 shadow-elegant">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-3xl font-bold text-[#1b0e0e] break-words mb-2">
                          {mv.title}
                          {mv.year ? <span className="ml-3 text-[#6b4a4c] text-xl font-medium">({mv.year})</span> : null}
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm">
                          {mv.type ? <span className="px-3 py-1.5 rounded-full bg-gradient-to-r from-[#994d51]/20 to-[#7a3d41]/20 text-[#994d51] font-medium border border-[#994d51]/20">{mv.type}</span> : null}
                          {(mv.genre ?? "")
                            .split(",")
                            .map((g) => g.trim())
                            .filter(Boolean)
                            .map((g) => (
                              <span key={g} className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-700 font-medium border border-emerald-200">{g}</span>
                            ))}
                        </div>
                      </div>
                      {overall !== undefined ? (
                        <div className="flex-shrink-0">
                          <div className="glass rounded-2xl px-4 py-3 shadow-elegant border border-white/30 text-center">
                            <div className="text-2xl font-bold gradient-text">{overall.toFixed(1)}</div>
                            <div className="text-xs text-[#6b4a4c] font-medium mt-1">⭐ Overall Rating</div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="glass-strong rounded-2xl p-6 border border-white/30 shadow-elegant">
                    <h3 className="text-lg font-semibold text-[#1b0e0e] mb-4 flex items-center gap-2">
                      📊 Movie Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InfoRow label="Rated" value={mv.rated} />
                      <InfoRow label="Runtime" value={mv.runtime} />
                      <InfoRow label="Released" value={mv.released} />
                      <InfoRow label="Language" value={mv.language} />
                      <InfoRow label="Country" value={mv.country} />
                      <InfoRow label="Awards" value={mv.awards} />
                      <InfoRow label="Box Office" value={mv.boxOffice ?? undefined} />
                      <InfoRow label="Website" value={mv.website} />
                    </div>
                  </div>

                  <div className="glass-strong rounded-2xl p-6 border border-white/30 shadow-elegant">
                    <h3 className="text-lg font-semibold text-[#1b0e0e] mb-4 flex items-center gap-2">
                      🎭 Cast & Crew
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <InfoRow label="Director" value={mv.director} />
                      <InfoRow label="Writer" value={mv.writer} />
                      <InfoRow label="Actors" value={mv.actors} />
                    </div>
                  </div>

                  {mv.plot ? (
                    <div className="glass-strong rounded-2xl p-6 border border-white/30 shadow-elegant">
                      <h3 className="text-lg font-semibold text-[#1b0e0e] mb-4 flex items-center gap-2">
                        📖 Plot Summary
                      </h3>
                      <div className="text-[#1b0e0e] text-sm leading-relaxed">{mv.plot}</div>
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      className="glass rounded-xl px-6 py-3 text-sm font-semibold text-[#994d51] hover:text-white hover:bg-gradient-to-r hover:from-[#994d51] hover:to-[#7a3d41] transition-all duration-300 shadow-elegant hover:shadow-elegant-lg hover:scale-105 border border-[#994d51]/30"
                      onClick={() => setTab("edit")}
                    >
                      ✏️ Edit Scores
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!isLoading && mv && tab === "edit" && (
              <MovieDetailsClient movieId={movieId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
