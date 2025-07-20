import { db } from "~/server/db";
import { evaluation, evaluationScore, criteria } from "~/server/db/schema";
import { HydrateClient } from "~/trpc/server";
import Link from "next/link";

export default async function Home() {
  const movies = await db.query.movie.findMany({
    where: (movie, { eq }) => eq(movie.type, 'movie'),
  });

  // Fetch all criteria, evaluations, and scores
  const allCriteria = await db.select().from(criteria);
  const evaluations = await db.select().from(evaluation);
  const scores = await db.select().from(evaluationScore);

  // Build criteria tree
  const mainCriteria = allCriteria.filter(c => !c.parentId);
  const subCriteria = allCriteria.filter(c => c.parentId);

  // Map: criteriaId -> criteria

  // Map: movieId -> [evaluationIds]
  const movieEvaluations: Record<string, string[]> = {};
  evaluations.forEach(ev => {
    if (ev.movieId) {
      if (!movieEvaluations[ev.movieId]) movieEvaluations[ev.movieId] = [];
      movieEvaluations[ev.movieId]?.push(ev.id);
    }
  });

  // Map: evaluationId -> [score]
  const evalScores: Record<string, {criteriaId: string, score: number}[]> = {};
  scores.forEach(s => {
    if (s.evaluationId) {
      if (!evalScores[s.evaluationId]) evalScores[s.evaluationId] = [];
      evalScores[s.evaluationId]?.push({ criteriaId: s.criteriaId ?? '', score: Number(s.score) });
    }
  });

  // Calculate weighted overall rating for each movie
  const movieWeightedAverages: Record<string, number> = {};
  for (const movie of movies) {
    const evalIds = movieEvaluations[movie.id] || [];
    // For each main criteria, calculate weighted score
    let weightedSum = 0;
    let totalWeight = 0;
    for (const main of mainCriteria) {
      // Find all sub-criteria for this main
      const subs = subCriteria.filter(sc => sc.parentId === main.id);
      // For each sub-criteria, gather all scores for this movie
      let subWeightedSum = 0;
      let subTotalWeight = 0;
      for (const sub of subs) {
        const subScores: number[] = [];
        for (const evalId of evalIds) {
          const scoresForEval = evalScores[evalId] || [];
          const found = scoresForEval.find(s => s.criteriaId === sub.id);
          if (found) subScores.push(found.score);
        }
        if (subScores.length > 0 && sub.weight) {
          const avg = subScores.reduce((a, b) => a + b, 0) / subScores.length;
          subWeightedSum += avg * sub.weight;
          subTotalWeight += sub.weight;
        }
      }
      // Main-criteria value is weighted sum of sub-criteria
      if (subTotalWeight > 0 && main.weight) {
        const mainValue = subWeightedSum / subTotalWeight;
        weightedSum += mainValue * main.weight;
        totalWeight += main.weight;
      }
    }
    if (totalWeight > 0) {
      movieWeightedAverages[movie.id] = Math.round((weightedSum / totalWeight) * 10) / 10;
    }
  }

  return (
    <HydrateClient>
    <div className="relative flex size-full min-h-screen flex-col bg-[#fcf8f8] group/design-root overflow-x-hidden" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            <div className="flex flex-wrap justify-between gap-3 p-4">
              <p className="text-[#1b0e0e] tracking-light text-[32px] font-bold leading-tight min-w-72">My Evaluations</p>
              <Link href="/new">
              <button
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-8 px-4 bg-[#f3e7e8] text-[#1b0e0e] text-sm font-medium leading-normal"
              >
                <span className="truncate">New Evaluation</span>
              </button></Link>
            </div>
            <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">Movies</h3>
            <div className="px-4 py-3 @container">
              <div className="flex overflow-hidden rounded-lg border border-[#e7d0d1] bg-[#fcf8f8]">
                <table className="flex-1">
                  <thead>
                    <tr className="bg-[#fcf8f8]">
                      <th className="table-4b71dd59-20ab-4d2f-97c8-6e3885901538-column-120 px-4 py-3 text-left text-[#1b0e0e] w-[400px] text-sm font-medium leading-normal">Title</th>
                      <th className="table-4b71dd59-20ab-4d2f-97c8-6e3885901538-column-240 px-4 py-3 text-left text-[#1b0e0e] w-[400px] text-sm font-medium leading-normal">Genre</th>
                      <th className="table-4b71dd59-20ab-4d2f-97c8-6e3885901538-column-360 px-4 py-3 text-left text-[#1b0e0e] w-[400px] text-sm font-medium leading-normal">Rating</th>
                      <th className="table-4b71dd59-20ab-4d2f-97c8-6e3885901538-column-480 px-4 py-3 text-left text-[#1b0e0e] w-60 text-[#994d51] text-sm font-medium leading-normal">
                        Review
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {movies.sort((a, b) => (movieWeightedAverages[b.id] ?? 0) - (movieWeightedAverages[a.id]??0)).filter(m => m.type === 'movie').map((movie) => (
                      <tr key={movie.id} className="border-t border-t-[#e7d0d1]">
                      <td className="table-4b71dd59-20ab-4d2f-97c8-6e3885901538-column-120 h-[72px] px-4 py-2 w-[400px] text-[#1b0e0e] text-sm font-normal leading-normal">
                          {movie.title}
                      </td>
                        <td className="table-4b71dd59-20ab-4d2f-97c8-6e3885901538-column-240 h-[72px] px-4 py-2 w-[400px] text-[#994d51] text-sm font-normal leading-normal">{movie.genre || '-'}</td>
                      <td className="table-4b71dd59-20ab-4d2f-97c8-6e3885901538-column-360 h-[72px] px-4 py-2 w-[400px] text-sm font-normal leading-normal">
                        <div className="flex items-center gap-3">
                            <div className="w-[88px] overflow-hidden rounded-sm bg-[#e7d0d1]">
                              <div className="h-1 rounded-full bg-[#e92932]" style={{ width: `${movieWeightedAverages[movie.id] !== undefined ? (movieWeightedAverages[movie.id] ?? 0) * 20 : '0'}%` }}></div>
                        </div>
                            <p className="text-[#1b0e0e] text-sm font-medium leading-normal">{movieWeightedAverages[movie.id] !== undefined ? movieWeightedAverages[movie.id] : '-'}</p>
                        </div>
                      </td>
                      <td className="table-4b71dd59-20ab-4d2f-97c8-6e3885901538-column-480 h-[72px] px-4 py-2 w-60 text-[#994d51] text-sm font-bold leading-normal tracking-[0.015em]">
<Link href={"/"+movie.id}>
                        View</Link>
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-4 pb-2 pt-4">TV Series</h3>
            <div className="px-4 py-3 @container">
              <div className="flex overflow-hidden rounded-lg border border-[#e7d0d1] bg-[#fcf8f8]">
                <table className="flex-1">
                  <thead>
                    <tr className="bg-[#fcf8f8]">
                      <th className="table-5064def8-fe13-4272-ba13-5f91e8b53a99-column-120 px-4 py-3 text-left text-[#1b0e0e] w-[400px] text-sm font-medium leading-normal">Title</th>
                      <th className="table-5064def8-fe13-4272-ba13-5f91e8b53a99-column-240 px-4 py-3 text-left text-[#1b0e0e] w-[400px] text-sm font-medium leading-normal">Genre</th>
                      <th className="table-5064def8-fe13-4272-ba13-5f91e8b53a99-column-360 px-4 py-3 text-left text-[#1b0e0e] w-[400px] text-sm font-medium leading-normal">Rating</th>
                      <th className="table-5064def8-fe13-4272-ba13-5f91e8b53a99-column-480 px-4 py-3 text-left text-[#1b0e0e] w-60 text-[#994d51] text-sm font-medium leading-normal">
                        Review
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {movies.filter(m => m.type === 'series').map((series) => (
                      <tr key={series.id} className="border-t border-t-[#e7d0d1]">
                      <td className="table-5064def8-fe13-4272-ba13-5f91e8b53a99-column-120 h-[72px] px-4 py-2 w-[400px] text-[#1b0e0e] text-sm font-normal leading-normal">
                          {series.title}
                      </td>
                        <td className="table-5064def8-fe13-4272-ba13-5f91e8b53a99-column-240 h-[72px] px-4 py-2 w-[400px] text-[#994d51] text-sm font-normal leading-normal">{series.genre || '-'}</td>
                      <td className="table-5064def8-fe13-4272-ba13-5f91e8b53a99-column-360 h-[72px] px-4 py-2 w-[400px] text-sm font-normal leading-normal">
                        <div className="flex items-center gap-3">
                            <div className="w-[88px] overflow-hidden rounded-sm bg-[#e7d0d1]"><div className="h-1 rounded-full bg-[#e92932]" style={{ width: `${movieWeightedAverages[series.id] !== undefined ? (movieWeightedAverages[series.id] ?? 0) * 20 : '0'}%` }}></div></div>
                            <p className="text-[#1b0e0e] text-sm font-medium leading-normal">{movieWeightedAverages[series.id] !== undefined ? movieWeightedAverages[series.id] : '-'}</p>
                        </div>
                      </td>
                      <td className="table-5064def8-fe13-4272-ba13-5f91e8b53a99-column-480 h-[72px] px-4 py-2 w-60 text-[#994d51] text-sm font-bold leading-normal tracking-[0.015em]">
                        View
                      </td>
                    </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    </HydrateClient>
  );
}
