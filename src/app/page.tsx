import { db } from "~/server/db";
import { evaluation, evaluationScore, criteria, movie } from "~/server/db/schema";
import { HydrateClient } from "~/trpc/server";
import Link from "next/link";
import { and, desc, eq, like, sql } from "drizzle-orm";
import SavedFilters from "./_components/SavedFilters";
import SearchHotkeys from "./_components/SearchHotkeys";
import CardActions from "./_components/CardActions";
import HomeGalleryClient from "./_components/HomeGalleryClient";
import CompareDock from "./_components/CompareDock";
import LocalStatusFilters from "./_components/LocalStatusFilters";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    size?: string;
    page?: string;
    search?: string;
    type?: string;
    yearFrom?: string;
    yearTo?: string;
    genre?: string;
    director?: string;
    actor?: string;
    writer?: string;
    minRating?: string;
    sort?: string;
  }>;
}) {
  const {
    size,
    page = "1",
    search = "",
    type,
    yearFrom,
    yearTo,
    genre = "",
    director = "",
    actor = "",
    writer = "",
    minRating,
    sort = "weighted",
  } = await searchParams;
  const currentPage = 1;
  const pageSize = 60;
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
          // Writer contains
          writer ? like(movie.writer, `%${writer}%`) : sql`TRUE`,
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
    .limit(pageSize)
    .offset(0);

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
  const movieMainBreakdown: Record<string, { name: string; value: number }[]> = {};
  for (const mv of movies) {
    const evalIds = movieEvaluations[mv.id] || [];
    let weightedSum = 0;
    let totalWeight = 0;
    const mainValues: { name: string; value: number }[] = [];
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
        if (main.name) mainValues.push({ name: main.name, value: Math.round(mainValue * 10) / 10 });
      }
    }
    if (totalWeight > 0) {
      movieWeightedAverages[mv.id] =
        Math.round((weightedSum / totalWeight) * 100) / 100;
    }
    movieMainBreakdown[mv.id] = mainValues
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .slice(0, 3);
  }

  const sizeOpt: "small" | "big" = size === "small" || size === "big" ? (size as any) : "big";
  // Build query suffix to preserve filters in links
  const q = new URLSearchParams();
  if (search) q.set("search", search);
  if (type) q.set("type", type);
  if (yearFrom) q.set("yearFrom", yearFrom);
  if (yearTo) q.set("yearTo", yearTo);
  if (genre) q.set("genre", genre);
  if (director) q.set("director", director);
  if (actor) q.set("actor", actor);
  if (writer) q.set("writer", writer);
  if (minRating) q.set("minRating", minRating);
  if (sort) q.set("sort", sort);
  // Build fetch query for client to continue loading pages from API

  return (
    <HydrateClient>
      <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
            <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
              {/* Search bar */}
              {/* Keyboard UX hook */}
              <SearchHotkeys formId="search-form" />
              <form id="search-form" className="mb-8 glass-strong rounded-2xl p-6 shadow-elegant-lg">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Title</label>
                    <input
                      type="text"
                      name="search"
                      defaultValue={search}
                      placeholder="e.g. Inception"
                      className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60 text-[#1b0e0e]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Type</label>
                    <select name="type" defaultValue={type ?? "movie"} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 text-[#1b0e0e]">
                      <option value="">Any</option>
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                      <option value="episode">Episode</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Year From</label>
                    <input type="number" name="yearFrom" defaultValue={yearFrom ?? ""} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 text-[#1b0e0e]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Year To</label>
                    <input type="number" name="yearTo" defaultValue={yearTo ?? ""} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 text-[#1b0e0e]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Min Rating</label>
                    <input type="number" step="0.1" min="0" max="5" name="minRating" defaultValue={minRating ?? ""} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 text-[#1b0e0e]" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Genre</label>
                    <input type="text" name="genre" defaultValue={genre} placeholder="e.g. action" className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60 text-[#1b0e0e]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Director</label>
                    <input type="text" name="director" defaultValue={director} placeholder="e.g. Nolan" className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60 text-[#1b0e0e]" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Actor</label>
                    <input type="text" name="actor" defaultValue={actor} placeholder="e.g. DiCaprio" className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60 text-[#1b0e0e]" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Writer</label>
                    <input type="text" name="writer" defaultValue={writer} placeholder="e.g. Sorkin" className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 placeholder:text-[#6b4a4c]/60 text-[#1b0e0e]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#6b4a4c] mb-2">Sort</label>
                    <select name="sort" defaultValue={sort} className="focus-ring border border-white/30 rounded-xl px-4 py-3 w-full bg-white/50 backdrop-blur-sm transition-all duration-300 hover:bg-white/70 text-[#1b0e0e]">
                      <option value="weighted">Weighted rating</option>
                      <option value="rating">Average score</option>
                      <option value="yearDesc">Year (newest)</option>
                      <option value="yearAsc">Year (oldest)</option>
                      <option value="titleAsc">Title (A–Z)</option>
                      <option value="titleDesc">Title (Z–A)</option>
                    </select>
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

              {/* Size, count, dashboard, and local filters (decluttered layout) */}
              <div className="mb-8 flex flex-col gap-4">
                {/* Row 1: Size toggle + Count + Dashboard */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[#6b4a4c] text-sm font-semibold">Size:</span>
                    <div className="glass rounded-2xl overflow-hidden shadow-elegant">
                      <Link
                        href={`/?size=small&${q.toString()}`}
                        className={`inline-flex items-center px-5 py-2.5 text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                          sizeOpt === "small"
                            ? "bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white shadow-elegant"
                            : "text-[#6b4a4c] hover:text-[#994d51] hover:bg-white/60"
                        }`}
                      >
                        {sizeOpt !== "small" && (
                          <div className="absolute inset-0 bg-gradient-to-r from-[#994d51]/10 to-[#7a3d41]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        )}
                        <span className="relative z-10 flex items-center gap-2">▫️ Small</span>
                      </Link>
                      <Link
                        href={`/?size=big&${q.toString()}`}
                        className={`inline-flex items-center px-5 py-2.5 text-sm font-medium transition-all duration-300 relative overflow-hidden group ${
                          sizeOpt === "big"
                            ? "bg-gradient-to-r from-[#994d51] to-[#7a3d41] text-white shadow-elegant"
                            : "text-[#6b4a4c] hover:text-[#994d51] hover:bg-white/60"
                        }`}
                      >
                        {sizeOpt !== "big" && (
                          <div className="absolute inset-0 bg-gradient-to-r from-[#994d51]/10 to-[#7a3d41]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        )}
                        <span className="relative z-10 flex items-center gap-2">🧩 Big</span>
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-[#6b4a4c] font-medium whitespace-nowrap">{count} found</div>
                    <Link
                      href="/dashboard"
                      className="glass rounded-xl px-4 py-2 text-sm font-semibold text-[#1b0e0e] border border-white/30 shadow-elegant hover:shadow-elegant-lg transition-all duration-300 hover:text-[#994d51]"
                      title="Open analytics dashboard"
                    >
                      📊 Dashboard
                    </Link>
                  </div>
                </div>

                {/* Row 2: Local quick filters + Saved filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <LocalStatusFilters gridId="movies-grid" />
                  <div className="grow" />
                  <SavedFilters current={{ search, type, yearFrom, yearTo, genre, director, actor, writer, minRating, sort }} />
                </div>
              </div>

              {/* Movie list (always gallery, size-configurable) */}
              <HomeGalleryClient
                  movies={movies.map(m => ({ id: m.id, title: m.title, posterUrl: m.posterUrl, year: Number(m.year ?? 0) || null, type: m.type }))}
                  weighted={movieWeightedAverages}
                  breakdown={movieMainBreakdown}
                  totalCount={count}
                  fetchQuery={q.toString()}
                  pageSize={pageSize}
                  gridId="movies-grid"
                  size={sizeOpt}
                />
              {/* Floating compare dock */}
              <CompareDock />

            </div>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
