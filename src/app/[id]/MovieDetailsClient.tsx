"use client";
import Link from "next/link";
import { api } from "~/trpc/react";

export default function MovieDetailsClient({ movieId }: { movieId: string }) {
  // Fetch all data via tRPC
  const { data: movie, isLoading: movieLoading } = api.movie.getById.useQuery({ id: movieId });
  const { data: allCriteria = [], isLoading: criteriaLoading } = api.movie.getAllCriteria.useQuery();
  const { data: evaluations = [] } = api.movie.getEvaluationsByMovie.useQuery({ movieId });
  const evalIds = evaluations.map(e => e.id);
  const { data: scores = [] } = api.movie.getScoresByEvaluationIds.useQuery({ evalIds });

  const utils = api.useUtils();
  const upsertScore = api.movie.upsertEvaluationScore.useMutation({
    onSuccess: () => {
      utils.movie.getScoresByEvaluationIds.invalidate({ evalIds }).catch(() => console.log(""));
    },
  });

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
    <div className="relative flex size-full min-h-screen flex-col bg-[#fcf8f8] group/design-root overflow-x-hidden" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            <div className="flex flex-wrap justify-between gap-3 p-4">
              <p className="text-[#1b0e0e] tracking-light text-[32px] font-bold leading-tight min-w-72">Review: {movie.title}</p>
            </div>
            <div className="@container">
              <div className="relative flex w-full flex-col items-start justify-between gap-3 p-4 @[480px]:flex-row @[480px]:items-center">
                <div className="flex w-full shrink-[3] items-center justify-between">
                  <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em]">Overall Score</h3>
                  <p className="text-[#1b0e0e] text-sm font-normal leading-normal @[480px]:hidden">{overall ?? '-'}</p>
                </div>
                <div className="flex h-4 w-full items-center gap-4">
                  <div className="flex h-1 flex-1 rounded-sm bg-[#e7d0d1]">
                    <div className="h-full rounded-sm bg-[#5e5d5d]" style={{ width: `${overall !== undefined ? overall * 20 : 0}%` }}></div>
                    <div className="relative"><div className="absolute -left-2 -top-1.5 size-4 rounded-full bg-[#5e5d5d]"></div></div>
                  </div>
                  <p className="text-[#1b0e0e] text-sm font-normal leading-normal hidden @[480px]:block">{overall ?? '-'}</p>
                </div>
              </div>
            </div>
            {mainCriteria.sort((a, b) => (b.weight??0) - (a.weight ??0)).map(main => (
              <div key={main.id}>
                <div className="@container">
                  <div className="relative flex w-full flex-col items-start justify-between gap-3 p-4 @[480px]:flex-row @[480px]:items-center">
                    <div className="flex w-full shrink-[3] items-center justify-between">
                      <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em]">{main.name}</h3>
                      <p className="text-[#1b0e0e] text-sm font-normal leading-normal @[480px]:hidden">{mainValues[main.id] !== undefined ? mainValues[main.id] : '-'}</p>
                    </div>
                    <div className="flex h-4 w-full items-center gap-4">
                      <div className="flex h-1 flex-1 rounded-sm bg-[#e7d0d1]">
                        <div className="h-full rounded-sm bg-[#5e5d5d]" style={{ width: `${mainValues[main.id] !== undefined ? (mainValues[main.id] ?? 0) * 20 : 0}%` }}></div>
                        <div className="relative"><div className="absolute -left-2 -top-1.5 size-4 rounded-full bg-[#5e5d5d]"></div></div>
                      </div>
                      <p className="text-[#1b0e0e] text-sm font-normal leading-normal hidden @[480px]:block">{mainValues[main.id] !== undefined ? mainValues[main.id] : '-'}</p>
                    </div>
                  </div>
                </div>
                {subCriteria.filter(sc => sc.parentId === main.id).map(sub => (
                  <div className="@container" key={sub.id}>
                    <div className="relative flex w-full flex-col items-start justify-between gap-3 p-4 @[480px]:flex-row @[480px]:items-center">
                      <div className="flex w-full shrink-[3] items-center justify-between">
                        <p className="text-[#1b0e0e] text-base font-medium leading-normal">{sub.name}</p>
                        <div className="flex items-center gap-2">
                          <StarInput value={subAverages[sub.id] ?? 0} onChange={v => upsertScore.mutate({ movieId: movie.id, criteriaId: sub.id, score: v })} />
                          <span className="text-[#1b0e0e] text-sm font-normal leading-normal">{subAverages[sub.id] ?? '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Notes</h3>
            <div className="flex max-w-[480px] flex-wrap items-end gap-4 px-4 py-3">
              <label className="flex flex-col min-w-40 flex-1">
                <textarea
                  placeholder="Enter your notes here..."
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#1b0e0e] focus:outline-0 focus:ring-0 border border-[#e7d0d1] bg-[#fcf8f8] focus:border-[#e7d0d1] min-h-36 placeholder:text-[#994d51] p-[15px] text-base font-normal leading-normal"
                ></textarea>
              </label>
            </div>
            <div className="flex px-4 py-3 justify-end">
              <button
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#e92932] text-[#fcf8f8] text-sm font-bold leading-normal tracking-[0.015em]"
              >
<Link href="/">
                <span className="truncate">Submit Review</span>
</Link>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 