import { db } from "~/server/db";
import { evaluation, evaluationScore, criteria, movie } from "~/server/db/schema";
import { HydrateClient } from "~/trpc/server";
import Link from "next/link";
import { and, desc, eq, like, sql } from "drizzle-orm";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    page?: string;
    search?: string;
    type?: string;
    yearFrom?: string;
    yearTo?: string;
    genre?: string;
    director?: string;
    actor?: string;
    minRating?: string;
  }>;
}) {
  const {
    view,
    page = "1",
    search = "",
    type,
    yearFrom,
    yearTo,
    genre = "",
    director = "",
    actor = "",
    minRating,
  } = await searchParams;
  const currentPage = Math.max(parseInt(page) || 1, 1);
  const itemsPerPage = 50;
  const yearFromNum = yearFrom ? Number(yearFrom) : undefined;
  const yearToNum = yearTo ? Number(yearTo) : undefined;
  const minRatingNum = minRating ? Number(minRating) : undefined;

  // Movies query with search + pagination
  const moviesWithRatings = db.$with('movies_with_ratings').as(
    db
      .select({
        id: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        genre: movie.genre,
        type: movie.type,
        director: movie.director,
        actors: movie.actors,
        year: movie.year,
        rating: sql<number>`
          COALESCE((
            SELECT ROUND(AVG(es.score), 2)
            FROM ${evaluationScore} es
            JOIN ${evaluation} e ON e.id = es.evaluation_id
            WHERE e.movie_id = ${sql`${movie.id}`}
          ), 0)
        `.as('rating'),
      })
      .from(movie)
      .where(
        and(
          // Type filter (default to 'movie' when not specified)
          type ? eq(movie.type, type) : eq(movie.type, "movie"),
          // Title contains
          search ? like(movie.title, `%${search}%`) : sql`TRUE`,
          // Year range
          yearFromNum !== undefined ? sql`${movie.year} >= ${yearFromNum}` : sql`TRUE`,
          yearToNum !== undefined ? sql`${movie.year} <= ${yearToNum}` : sql`TRUE`,
          // Director contains
          director ? like(movie.director, `%${director}%`) : sql`TRUE`,
          // Actor contains
          actor ? like(movie.actors, `%${actor}%`) : sql`TRUE`,
          // Genre contains (any substring match over CSV field)
          genre ? like(movie.genre, `%${genre}%`) : sql`TRUE`
        )
      )
  );

  // Step 2 — Query from the CTE and order by rating
  const movies = await db
    .with(moviesWithRatings)
    .select()
    .from(moviesWithRatings)
    .where(minRatingNum !== undefined ? sql`${moviesWithRatings.rating} >= ${minRatingNum}` : sql`TRUE`)
    .orderBy(desc(moviesWithRatings.rating))
    .limit(itemsPerPage)
    .offset((currentPage - 1) * itemsPerPage);

  // Get total count for pagination
  // Count with the same filters (including minRating) using the CTE
  const countRows = await db
    .with(moviesWithRatings)
    .select({ count: sql<number>`COUNT(*)` })
    .from(moviesWithRatings)
    .where(minRatingNum !== undefined ? sql`${moviesWithRatings.rating} >= ${minRatingNum}` : sql`TRUE`);
  const count = countRows[0]?.count ?? 0;

  // Fetch all criteria, evaluations, and scores
  const allCriteria = await db.select().from(criteria);
  const evaluations = await db.select().from(evaluation);
  const scores = await db.select().from(evaluationScore);

  const mainCriteria = allCriteria.filter(c => !c.parentId);
  const subCriteria = allCriteria.filter(c => c.parentId);

  const movieEvaluations: Record<string, string[]> = {};
  evaluations.forEach(ev => {
    if (ev.movieId) {
      if (!movieEvaluations[ev.movieId]) movieEvaluations[ev.movieId] = [];
      movieEvaluations[ev.movieId]?.push(ev.id);
    }
  });

  const evalScores: Record<string, { criteriaId: string; score: number }[]> = {};
  scores.forEach(s => {
    if (s.evaluationId) {
      if (!evalScores[s.evaluationId]) evalScores[s.evaluationId] = [];
      evalScores[s.evaluationId]?.push({
        criteriaId: s.criteriaId ?? "",
        score: Number(s.score),
      });
    }
  });

  const movieWeightedAverages: Record<string, number> = {};
  for (const mv of movies) {
    const evalIds = movieEvaluations[mv.id] || [];
    let weightedSum = 0;
    let totalWeight = 0;
    for (const main of mainCriteria) {
      const subs = subCriteria.filter(sc => sc.parentId === main.id);
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
      if (subTotalWeight > 0 && main.weight) {
        const mainValue = subWeightedSum / subTotalWeight;
        weightedSum += mainValue * main.weight;
        totalWeight += main.weight;
      }
    }
    if (totalWeight > 0) {
      movieWeightedAverages[mv.id] =
        Math.round((weightedSum / totalWeight) * 100) / 100;
    }
  }

  const currentView =
    view === "gallery" || view === "detailed" ? view : "gallery";
  // Build query suffix to preserve filters in links
  const q = new URLSearchParams();
  if (search) q.set("search", search);
  if (type) q.set("type", type);
  if (yearFrom) q.set("yearFrom", yearFrom);
  if (yearTo) q.set("yearTo", yearTo);
  if (genre) q.set("genre", genre);
  if (director) q.set("director", director);
  if (actor) q.set("actor", actor);
  if (minRating) q.set("minRating", minRating);
  const totalPages = Math.ceil(count / itemsPerPage);

  return (
    <HydrateClient>
      <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
            <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
              {/* Search bar */}
              <form className="mb-8 glass-strong rounded-2xl p-6 shadow-elegant-lg">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Title</label>
                    <input
                      type="text"
                      name="search"
                      defaultValue={search}
                      placeholder="e.g. Inception"
                      className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Type</label>
                    <select name="type" defaultValue={type ?? "movie"} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70">
                      <option value="">Any</option>
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                      <option value="episode">Episode</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Year From</label>
                    <input type="number" name="yearFrom" defaultValue={yearFrom ?? ""} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Year To</label>
                    <input type="number" name="yearTo" defaultValue={yearTo ?? ""} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Min Rating</label>
                    <input type="number" step="0.1" min="0" max="5" name="minRating" defaultValue={minRating ?? ""} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Genre</label>
                    <input type="text" name="genre" defaultValue={genre} placeholder="e.g. action" className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Director</label>
                    <input type="text" name="director" defaultValue={director} placeholder="e.g. Nolan" className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Actor</label>
                    <input type="text" name="actor" defaultValue={actor} placeholder="e.g. DiCaprio" className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60" />
                  </div>
                  <div>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white rounded-xl w-full font-semibold shadow-elegant hover:shadow-elegant-lg transition-all duration-300 hover:scale-105 hover:from-[#7a3d41] hover:to-[#5d2e32]"
                    >
                      🔍 Search
                    </button>
                  </div>
                </div>
              </form>

              {/* View toggle buttons */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <span className="text-[#6b4a4c] text-sm font-semibold">View Mode:</span>
                  <div className="glass rounded-2xl overflow-hidden shadow-elegant">
                    <Link
                      href={`/?view=detailed&${q.toString()}`}
                      className={`inline-flex items-center px-6 py-3 text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                        currentView === "detailed"
                          ? "bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white shadow-elegant"
                          : "text-[#6b4a4c] hover:text-[#994d51] hover:bg-white/60 hover:scale-105"
                      }`}
                    >
                      {currentView !== "detailed" && (
                        <div className="absolute inset-0 bg-gradient-to-r from-[#994d51]/10 to-[#7a3d41]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        📋 Detailed
                      </span>
                    </Link>
                    <Link
                      href={`/?view=gallery&${q.toString()}`}
                      className={`inline-flex items-center px-6 py-3 text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                        currentView === "gallery"
                          ? "bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white shadow-elegant"
                          : "text-[#6b4a4c] hover:text-[#994d51] hover:bg-white/60 hover:scale-105"
                      }`}
                    >
                      {currentView !== "gallery" && (
                        <div className="absolute inset-0 bg-gradient-to-r from-[#994d51]/10 to-[#7a3d41]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        🎬 Gallery
                      </span>
                    </Link>
                  </div>
                </div>
                <div className="text-sm text-[#6b4a4c] font-medium">
                  {count} movies found
                </div>
              </div>

              {/* Movie list */}
              {currentView === "gallery" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                  {movies
                    .sort(
                      (a, b) =>
                        (movieWeightedAverages[b.id] ?? 0) -
                        (movieWeightedAverages[a.id] ?? 0)
                    )
                    .map(m => (
                      <Link
                        key={m.id}
                        href={`/${m.id}`}
                        className="group block"
                      >
                        <div className="glass-strong rounded-2xl overflow-hidden shadow-elegant border border-white/30 transition-all duration-500 hover:shadow-elegant-xl hover:scale-[1.05] hover:-translate-y-2 animate-float" style={{animationDelay: `${Math.random() * 2}s`}}>
                          <div className="aspect-[2/3] w-full overflow-hidden relative">
                            {m.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.posterUrl}
                                alt={m.title ?? "Poster"}
                                className="h-full w-full object-cover transition-all duration-500 group-hover:scale-110 group-hover:brightness-110"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#994d51] bg-gradient-to-br from-[#f3e7e8] to-[#e7d0d1] text-lg font-semibold">
                                🎬
                                <div className="mt-2 text-xs text-center px-2">No Poster</div>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                              <div className="text-white text-sm font-semibold line-clamp-2 drop-shadow-lg mb-2">
                                {m.title}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="text-white/80 text-xs">
                                  {m.year && `${m.year} • `}{m.type}
                                </div>
                                {movieWeightedAverages[m.id] && (
                                  <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white px-2 py-1 text-xs font-bold shadow-elegant">
                                    <span>⭐</span>
                                    <span>{movieWeightedAverages[m.id]?.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                </div>
              ) : (
                <div>
                  {/* Detailed table view (same logic as your original) */}
                  {/* ... */}
                </div>
              )}

              {/* Pagination */}
              <div className="flex justify-center items-center gap-4 mt-12">
                {currentPage > 1 && (
                  <Link
                    href={`/?page=${currentPage - 1}&view=${currentView}&${q.toString()}`}
                    className="glass rounded-xl px-6 py-3 text-[#6b4a4c] font-medium shadow-elegant hover:shadow-elegant-lg transition-all duration-300 hover:scale-105 hover:text-[#994d51]"
                  >
                    ← Previous
                  </Link>
                )}
                <div className="flex items-center gap-2 text-sm text-[#6b4a4c] font-medium">
                  <span>Page {currentPage} of {totalPages}</span>
                </div>
                {currentPage < totalPages && (
                  <Link
                    href={`/?page=${currentPage + 1}&view=${currentView}&${q.toString()}`}
                    className="glass rounded-xl px-6 py-3 text-[#6b4a4c] font-medium shadow-elegant hover:shadow-elegant-lg transition-all duration-300 hover:scale-105 hover:text-[#994d51]"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
