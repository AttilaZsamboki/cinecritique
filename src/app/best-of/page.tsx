import { db } from "~/server/db";
import { bestOf, criteria, evaluation, evaluationScore, movie } from "~/server/db/schema";
import Link from "next/link";
import { toYouTubeEmbedUrl } from "~/lib/utils";

export default async function BestOfPage({searchParams}: {searchParams: Promise<{view: string}>}) {
  const all = await db.select().from(bestOf);
  const allCriteria = await db.select().from(criteria);
  const allMovies = await db.select().from(movie);
  const evaluations = await db.select().from(evaluation);
  const scores = await db.select().from(evaluationScore);
  const genres = new Set(allMovies.map(m => m.genre))

  const mainCriteria = allCriteria.filter(c => !c.parentId);
  const subCriteria = allCriteria.filter(c => c.parentId);


  const evalScores: Record<string, {criteriaId: string, score: number}[]> = {};
  scores.forEach(s => {
    if (s.evaluationId) {
      if (!evalScores[s.evaluationId]) evalScores[s.evaluationId] = [];
      evalScores[s.evaluationId]?.push({ criteriaId: s.criteriaId ?? '', score: Number(s.score) });
    }
  });

  const movieEvaluations: Record<string, string[]> = {};
  evaluations.forEach(ev => {
    if (ev.movieId) {
      if (!movieEvaluations[ev.movieId]) movieEvaluations[ev.movieId] = [];
      movieEvaluations[ev.movieId]?.push(ev.id);
    }
  });
  const movieWeightedAverages: Record<string, Array<string>> = {};
  for (const movie of allMovies) {
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
      if (Number.parseFloat(movieWeightedAverages[movie.genre??""]?.[1]??"0") < weightedSum / totalWeight) {
        movieWeightedAverages[movie.genre??""] = [movie.id, (weightedSum / totalWeight).toString()]
      }
    }
  }

  const criteriaById = Object.fromEntries(allCriteria.map(c => [c.id, c] as const));
  const movieById = Object.fromEntries(allMovies.map(m => [m.id, m] as const));

  const viewSearch = (await searchParams).view;
  const currentView = (viewSearch === 'gallery' || viewSearch === 'detailed') ? viewSearch : 'gallery';
  


  return (
    <div className="relative flex size-full min-h-screen flex-col bg-gradient-to-br from-[#fcf8f8] via-[#f9f2f3] to-[#f5e8e9] group/design-root overflow-x-hidden" style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}>
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
          <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm border border-white/20 mb-8">
              <div>
                <h1 className="text-[#1b0e0e] tracking-tight text-3xl sm:text-4xl font-bold leading-tight">
                  Best In Category
                </h1>
                <p className="text-[#6b4a4c] mt-2 text-sm sm:text-base">
                  Discover the top performers across different criteria
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#6b4a4c] text-sm font-medium">View:</span>
                <div className="rounded-xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm overflow-hidden shadow-sm">
                  <Link 
                    href="/best-of?view=detailed" 
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      currentView === 'detailed' 
                        ? 'bg-[#994d51] text-white shadow-sm' 
                        : 'text-[#6b4a4c] hover:text-[#994d51] hover:bg-[#f3e7e8]'
                    }`}
                  >
                    Detailed
                  </Link>
                  <Link 
                    href="/best-of?view=gallery" 
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      currentView === 'gallery' 
                        ? 'bg-[#994d51] text-white shadow-sm' 
                        : 'text-[#6b4a4c] hover:text-[#994d51] hover:bg-[#f3e7e8]'
                    }`}
                  >
                    Gallery
                  </Link>
                </div>
              </div>
            </div>

            {/* Content Section */}
            {currentView === 'detailed' ? (
              <div className="px-2 sm:px-4 py-4 @container">
                <div className="overflow-hidden rounded-2xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm shadow-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#f8f0f1] to-[#f3e7e8]">
                        <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[35%]">Category</th>
                        <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[40%]">Title Holder</th>
                        <th className="px-6 py-4 text-left text-[#1b0e0e] text-sm font-semibold leading-normal w-[25%]">Clip</th>
                      </tr>
                    </thead>
                    <tbody>
                      {all.map((b, index) => {
                        const c = b.criteriaId ? criteriaById[b.criteriaId] : undefined;
                        const m = b.movieId ? movieById[b.movieId] : undefined;
                        return (
                          <tr key={b.id} className={`border-t border-t-[#e7d0d1] transition-colors duration-200 hover:bg-[#faf5f6] ${index % 2 === 0 ? 'bg-white/60' : 'bg-white/40'}`}>
                            <td className="px-6 py-4 text-[#1b0e0e] text-sm">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-[#994d51]"></div>
                                {c?.name ?? '-'}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-[#994d51] text-sm font-medium">
                              {m ? (
                                <Link 
                                  href={`/${m.id}`} 
                                  className="hover:text-[#7a3d41] transition-colors duration-200 underline decoration-dotted underline-offset-4"
                                >
                                  {m.title}
                                </Link>
                              ) : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                              {b.clipUrl ? (() => {
                                const yt = toYouTubeEmbedUrl(b.clipUrl);
                                return yt ? (
                                  <div className="relative group">
                                    <iframe
                                      className="w-48 h-24 rounded-lg shadow-md transition-transform duration-200 group-hover:scale-105"
                                      src={yt}
                                      title="YouTube video player"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      allowFullScreen
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-lg"></div>
                                  </div>
                                ) : (
                                  <div className="relative group">
                                    <video 
                                      className="w-48 h-24 rounded-lg object-cover shadow-md transition-transform duration-200 group-hover:scale-105" 
                                      controls 
                                      src={b.clipUrl} 
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 rounded-lg"></div>
                                  </div>
                                );
                              })() : (
                                <span className="text-[#994d51] italic">No clip available</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
              <div className="px-2 sm:px-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {all.map((b) => {
                    const m = b.movieId ? movieById[b.movieId] : undefined;
                    if (!m) return null;
                    const c = b.criteriaId ? criteriaById[b.criteriaId] : undefined;
                    return (
                      <Link key={b.id} href={`/${m.id}`} className="group block">
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border border-white/20 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1">
                          <div className="aspect-[2/3] w-full overflow-hidden relative">
                            {m.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img 
                                src={m.posterUrl} 
                                alt={m.title ?? 'Poster'} 
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" 
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#994d51] bg-gradient-to-br from-[#f3e7e8] to-[#e7d0d1]">
                                <div className="text-center">
                                  <div className="text-4xl mb-2">🎬</div>
                                  <div className="text-sm font-medium">No Image</div>
                                </div>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-[#994d51]"></div>
                              <span className="text-xs font-medium text-[#994d51] uppercase tracking-wide">
                                {c?.name ?? 'Unknown Category'}
                              </span>
                            </div>
                            <h3 className="text-[#1b0e0e] font-semibold text-sm leading-tight line-clamp-2 group-hover:text-[#994d51] transition-colors duration-200" title={m.title ?? ''}>
                              {m.title}
                            </h3>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                </div>
              <div className="px-2 sm:px-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Object.entries(movieWeightedAverages)
                    .sort((a, b) => {
                      // Sort by movie title alphabetically
                      return (a[0] ?? "").localeCompare(b[0] ?? "");
                    })
                    .map((movie) => {
                      const movieId = movie[1][0] ?? "";
                      const m = movieId ? movieById[movieId] : undefined;
                      if (!m) return null;

                      return (
                      <Link key={m.id} href={`/${m.id}`} className="group block">
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border border-white/20 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1">
                          <div className="aspect-[2/3] w-full overflow-hidden relative">
                            {m.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img 
                                src={m.posterUrl} 
                                alt={m.title ?? 'Poster'} 
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" 
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#994d51] bg-gradient-to-br from-[#f3e7e8] to-[#e7d0d1]">
                                <div className="text-center">
                                  <div className="text-4xl mb-2">🎬</div>
                                  <div className="text-sm font-medium">No Image</div>
                                </div>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 rounded-full bg-[#994d51]"></div>
                              <span className="text-xs font-medium text-[#994d51] uppercase tracking-wide">
                                BEST {movie[0] ?? 'Unknown Category'}
                              </span>
                            </div>
                            <h3 className="text-[#1b0e0e] font-semibold text-sm leading-tight line-clamp-2 group-hover:text-[#994d51] transition-colors duration-200" title={m.title ?? ''}>
                              {m.title}
                            </h3>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                </div>
</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

