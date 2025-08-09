import { db } from "~/server/db";
import { evaluation, evaluationScore, criteria } from "~/server/db/schema";
import { HydrateClient } from "~/trpc/server";
import Link from "next/link";

export default async function Home({
  searchParams,
}: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
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
      movieWeightedAverages[movie.id] = Math.round((weightedSum / totalWeight) * 100) / 100;
    }
  }

  const currentView = (view === 'gallery' || view === 'detailed') ? view : 'gallery';


  return (
    <HydrateClient>
    <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 mb-8">
              <div>
                <h1 className="text-[#1b0e0e] tracking-tight text-3xl sm:text-4xl font-bold leading-tight">My Evaluations</h1>
                <p className="text-[#6b4a4c] mt-2 text-sm sm:text-base">Browse and manage your movie and series reviews</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[#6b4a4c] text-sm font-medium">View:</span>
                <div className="rounded-xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm overflow-hidden shadow-sm">
                  <Link href="/?view=detailed" className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${currentView === 'detailed' ? 'bg-[#994d51] text-white shadow-sm' : 'text-[#6b4a4c] hover:text-[#994d51] hover:bg-[#f3e7e8]'}`}>Detailed</Link>
                  <Link href="/?view=gallery" className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${currentView === 'gallery' ? 'bg-[#994d51] text-white shadow-sm' : 'text-[#6b4a4c] hover:text-[#994d51] hover:bg-[#f3e7e8]'}`}>Gallery</Link>
                </div>
                <Link href="/new" className="inline-flex items-center h-9 rounded-xl px-3 text-sm font-semibold text-white bg-[#e92932] hover:bg-[#c61f27] transition-colors shadow-sm">
                  New Evaluation
                </Link>
              </div>
            </div>
            {currentView === 'detailed' ? (
              <>
                <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-2 sm:px-4 pb-2">Movies</h3>
                <div className="px-2 sm:px-4 py-4 @container">
                  <div className="overflow-hidden rounded-2xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm shadow-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#f8f0f1] to-[#f3e7e8]">
                          <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[40%]">Title</th>
                          <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[30%]">Genre</th>
                          <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[20%]">Rating</th>
                          <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[10%]">Review</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e7d0d1]">
                        {movies
                          .sort((a, b) => (movieWeightedAverages[b.id] ?? 0) - (movieWeightedAverages[a.id] ?? 0))
                          .filter(m => m.type === 'movie')
                          .map((movie) => (
                            <tr key={movie.id} className="transition-colors duration-200 hover:bg-[#faf5f6]">
                              <td className="px-6 py-4 text-[#1b0e0e] text-sm">{movie.title}</td>
                              <td className="px-6 py-4 text-[#994d51] text-sm">{movie.genre || '-'}</td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-[100px] overflow-hidden rounded-full bg-[#e7d0d1]">
                                    <div className="h-2 rounded-full bg-[#994d51]" style={{ width: `${movieWeightedAverages[movie.id] !== undefined ? (movieWeightedAverages[movie.id] ?? 0) * 20 : '0'}%` }}></div>
                                  </div>
                                  <p className="text-[#1b0e0e] text-sm font-medium leading-normal">{movieWeightedAverages[movie.id] !== undefined ? movieWeightedAverages[movie.id] : '-'}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-[#994d51] text-sm font-semibold underline decoration-dotted underline-offset-4"><Link href={`/${movie.id}`}>View</Link></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-2 sm:px-4 pb-2 pt-4">TV Series</h3>
                <div className="px-2 sm:px-4 py-4 @container">
                  <div className="overflow-hidden rounded-2xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm shadow-lg">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#f8f0f1] to-[#f3e7e8]">
                          <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[40%]">Title</th>
                          <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[30%]">Genre</th>
                          <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[20%]">Rating</th>
                          <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[10%]">Review</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e7d0d1]">
                        {movies
                          .filter(m => m.type === 'series')
                          .map((series) => (
                            <tr key={series.id} className="transition-colors duration-200 hover:bg-[#faf5f6]">
                              <td className="px-6 py-4 text-[#1b0e0e] text-sm">{series.title}</td>
                              <td className="px-6 py-4 text-[#994d51] text-sm">{series.genre || '-'}</td>
                              <td className="px-6 py-4 text-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-[100px] overflow-hidden rounded-full bg-[#e7d0d1]"><div className="h-2 rounded-full bg-[#994d51]" style={{ width: `${movieWeightedAverages[series.id] !== undefined ? (movieWeightedAverages[series.id] ?? 0) * 20 : '0'}%` }}></div></div>
                                  <p className="text-[#1b0e0e] text-sm font-medium leading-normal">{movieWeightedAverages[series.id] !== undefined ? movieWeightedAverages[series.id] : '-'}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-[#994d51] text-sm font-semibold">—</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-[#1b0e0e] text-lg font-bold leading-tight tracking-[-0.015em] px-2 sm:px-4 pb-2">Movies</h3>
                <div className="px-2 sm:px-4 py-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {movies
                      .sort((a, b) => (movieWeightedAverages[b.id] ?? 0) - (movieWeightedAverages[a.id] ?? 0))
                      .filter(m => m.type === 'movie')
                      .map((m) => (
                        <Link key={m.id} href={`/${m.id}`} className="group block">
                          <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border border-white/20 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                            <div className="aspect-[2/3] w-full overflow-hidden relative">
                              {m.posterUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={m.posterUrl} alt={m.title ?? 'Poster'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[#994d51] bg-gradient-to-br from-[#f3e7e8] to-[#e7d0d1]">No Image</div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                              <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                                <div className="text-white text-sm font-medium line-clamp-1 drop-shadow">{m.title}</div>
                                <div className="ml-2 rounded-full bg-white/80 text-[#994d51] px-2 py-0.5 text-xs font-semibold drop-shadow" title={`${movieWeightedAverages[m.id] ?? '-'}`}> {movieWeightedAverages[m.id] ?? '-'} </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    </HydrateClient>
  );
}
