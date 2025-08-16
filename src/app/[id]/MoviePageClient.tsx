"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import MovieDetailsClient from "./MovieDetailsClient";

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <div className="text-[#6b4a4c] min-w-24">{label}</div>
      <div className="text-[#1b0e0e]">{value}</div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 bg-white/60 rounded-2xl border border-white/20 shadow-sm mb-4">
              <h1 className="text-[#1b0e0e] tracking-light text-[28px] font-bold leading-tight break-words">{mv?.title ?? "Movie"}</h1>
              <div className="inline-flex rounded-xl border border-[#e7d0d1] bg-white p-1 shadow-sm">
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'details' ? 'bg-[#994d51] text-white' : 'text-[#1b0e0e] hover:bg-[#f3e7e8]'}`}
                  onClick={() => setTab("details")}
                >Details</button>
                <button
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === 'edit' ? 'bg-[#994d51] text-white' : 'text-[#1b0e0e] hover:bg-[#f3e7e8]'}`}
                  onClick={() => setTab("edit")}
                >Edit</button>
              </div>
            </div>

            {isLoading && <div className="text-sm text-[#1b0e0e]">Loading...</div>}

            {!isLoading && mv && tab === "details" && (
              <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6">
                <div className="rounded-2xl overflow-hidden bg-white/80 border border-white/20 shadow-sm">
                  <div className="aspect-[2/3] bg-[#f3e7e8] flex items-center justify-center">
                    {mv.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mv.posterUrl} alt={mv.title ?? ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-[#6b4a4c] text-xs p-4">No poster</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-4 min-w-0">
                  <div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-2xl font-bold text-[#1b0e0e] break-words">
                        {mv.title}
                        {mv.year ? <span className="ml-2 text-[#6b4a4c] text-lg">({mv.year})</span> : null}
                      </div>
                      {overall !== undefined ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f3e7e8] px-2.5 py-1 text-sm text-[#1b0e0e]" title="Overall rating">
                          <span>★</span>
                          <span className="font-semibold">{overall.toFixed(1)}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {mv.type ? <span className="px-2 py-1 rounded-full bg-[#f3e7e8] text-[#1b0e0e]">{mv.type}</span> : null}
                      {(mv.genre ?? "")
                        .split(",")
                        .map((g) => g.trim())
                        .filter(Boolean)
                        .map((g) => (
                          <span key={g} className="px-2 py-1 rounded-full bg-[#e6f6ef] text-[#135c36]">{g}</span>
                        ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-white/20 bg-white/60 p-4">
                    <InfoRow label="Rated" value={mv.rated} />
                    <InfoRow label="Runtime" value={mv.runtime} />
                    <InfoRow label="Released" value={mv.released} />
                    <InfoRow label="Language" value={mv.language} />
                    <InfoRow label="Country" value={mv.country} />
                    <InfoRow label="Awards" value={mv.awards} />
                    <InfoRow label="Box Office" value={mv.boxOffice ?? undefined} />
                    <InfoRow label="Website" value={mv.website} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/20 bg-white/60 p-4">
                    <InfoRow label="Director" value={mv.director} />
                    <InfoRow label="Writer" value={mv.writer} />
                    <InfoRow label="Actors" value={mv.actors} />
                  </div>

                  {mv.plot ? (
                    <div className="rounded-2xl border border-white/20 bg-white/60 p-4">
                      <div className="text-sm text-[#6b4a4c] mb-1">Plot</div>
                      <div className="text-[#1b0e0e] text-sm leading-relaxed">{mv.plot}</div>
                    </div>
                  ) : null}

                  <div className="flex justify-end">
                    <button
                      className="rounded-xl bg-[#994d51] px-3 py-2 text-sm text-white hover:bg-[#7a3d41]"
                      onClick={() => setTab("edit")}
                    >Edit Scores</button>
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
