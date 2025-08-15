import { db } from "~/server/db";
import { evaluation, evaluationScore, criteria, movie } from "~/server/db/schema";
import { HydrateClient } from "~/trpc/server";
import Link from "next/link";
import { and, desc, eq, like, sql } from "drizzle-orm";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string; search?: string }>;
}) {
  const { view, page = "1", search = "" } = await searchParams;
  const currentPage = Math.max(parseInt(page) || 1, 1);
  const itemsPerPage = 50;

  // Movies query with search + pagination
  const moviesWithRatings = db.$with('movies_with_ratings').as(
    db
      .select({
        id: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        genre: movie.genre,
        type: movie.type,
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
          eq(movie.type, "movie"),
          search ? like(movie.title, `%${search}%`) : sql`TRUE`
        )
      )
  );

  // Step 2 — Query from the CTE and order by rating
  const movies = await db
    .with(moviesWithRatings)
    .select()
    .from(moviesWithRatings)
    .orderBy(desc(moviesWithRatings.rating))
    .limit(itemsPerPage)
    .offset((currentPage - 1) * itemsPerPage);

  // Get total count for pagination
  const countRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(movie)
    .where(
      and(
        eq(movie.type, "movie"),
        search ? like(movie.title, `%${search}%`) : sql`TRUE`
      )
    );
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
  const totalPages = Math.ceil(count / itemsPerPage);

  return (
    <HydrateClient>
      <div className="relative flex size-full min-h-screen flex-col group/design-root overflow-x-hidden">
        <div className="layout-container flex h-full grow flex-col">
          <div className="px-4 sm:px-8 lg:px-40 flex flex-1 justify-center py-8">
            <div className="layout-content-container flex flex-col max-w-[1200px] flex-1">
              {/* Search bar */}
              <form className="mb-6 flex gap-2">
                <input
                  type="text"
                  name="search"
                  defaultValue={search}
                  placeholder="Search movies..."
                  className="border rounded-lg px-4 py-2 flex-1"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#994d51] text-white rounded-lg"
                >
                  Search
                </button>
              </form>

              {/* View toggle buttons */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[#6b4a4c] text-sm font-medium">View:</span>
                <div className="rounded-xl border border-[#e7d0d1] bg-white/80 backdrop-blur-sm overflow-hidden shadow-sm">
                  <Link
                    href={`/?view=detailed&search=${search}`}
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      currentView === "detailed"
                        ? "bg-[#994d51] text-white shadow-sm"
                        : "text-[#6b4a4c] hover:text-[#994d51] hover:bg-[#f3e7e8]"
                    }`}
                  >
                    Detailed
                  </Link>
                  <Link
                    href={`/?view=gallery&search=${search}`}
                    className={`px-4 py-2 text-sm font-medium transition-all duration-200 ${
                      currentView === "gallery"
                        ? "bg-[#994d51] text-white shadow-sm"
                        : "text-[#6b4a4c] hover:text-[#994d51] hover:bg-[#f3e7e8]"
                    }`}
                  >
                    Gallery
                  </Link>
                </div>
              </div>

              {/* Movie list */}
              {currentView === "gallery" ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border border-white/20 transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                          <div className="aspect-[2/3] w-full overflow-hidden relative">
                            {m.posterUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.posterUrl}
                                alt={m.title ?? "Poster"}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[#994d51] bg-gradient-to-br from-[#f3e7e8] to-[#e7d0d1]">
                                No Image
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                              <div className="text-white text-sm font-medium line-clamp-1 drop-shadow">
                                {m.title}
                              </div>
                              <div
                                className="ml-2 rounded-full bg-white/80 text-[#994d51] px-2 py-0.5 text-xs font-semibold drop-shadow"
                                title={`${movieWeightedAverages[m.id] ?? "-"}`}
                              >
                                {movieWeightedAverages[m.id] ?? "-"}
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
              <div className="flex justify-center gap-4 mt-6">
                {currentPage > 1 && (
                  <Link
                    href={`/?page=${currentPage - 1}&view=${currentView}&search=${search}`}
                    className="px-4 py-2 bg-gray-200 rounded-lg"
                  >
                    Previous
                  </Link>
                )}
                {currentPage < totalPages && (
                  <Link
                    href={`/?page=${currentPage + 1}&view=${currentView}&search=${search}`}
                    className="px-4 py-2 bg-gray-200 rounded-lg"
                  >
                    Next
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
