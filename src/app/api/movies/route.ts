import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { evaluation, evaluationScore, criteria, movie } from "~/server/db/schema";
import { and, desc, eq, like, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(searchParams.get("pageSize") || "60", 10) || 60, 1), 200);
  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || undefined;
  const yearFrom = searchParams.get("yearFrom");
  const yearTo = searchParams.get("yearTo");
  const genre = searchParams.get("genre") || "";
  const director = searchParams.get("director") || "";
  const actor = searchParams.get("actor") || "";
  const writer = searchParams.get("writer") || "";
  const minRating = searchParams.get("minRating");
  const sort = searchParams.get("sort") || "weighted";

  const yearFromNum = yearFrom ? Number(yearFrom) : undefined;
  const yearToNum = yearTo ? Number(yearTo) : undefined;
  const minRatingNum = minRating ? Number(minRating) : undefined;

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
          type ? eq(movie.type, type) : eq(movie.type, "movie"),
          search ? like(movie.title, `%${search}%`) : sql`TRUE`,
          yearFromNum !== undefined ? sql`${movie.year} >= ${yearFromNum}` : sql`TRUE`,
          yearToNum !== undefined ? sql`${movie.year} <= ${yearToNum}` : sql`TRUE`,
          director ? like(movie.director, `%${director}%`) : sql`TRUE`,
          actor ? like(movie.actors, `%${actor}%`) : sql`TRUE`,
          writer ? like(movie.writer, `%${writer}%`) : sql`TRUE`,
          genre ? like(movie.genre, `%${genre}%`) : sql`TRUE`
        )
      )
  );

  const movies = await db
    .with(moviesWithRatings)
    .select()
    .from(moviesWithRatings)
    .where(minRatingNum !== undefined ? sql`${moviesWithRatings.rating} >= ${minRatingNum}` : sql`TRUE`)
    .orderBy(desc(moviesWithRatings.rating))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .with(moviesWithRatings)
    .select({ count: sql<number>`COUNT(*)` })
    .from(moviesWithRatings)
    .where(minRatingNum !== undefined ? sql`${moviesWithRatings.rating} >= ${minRatingNum}` : sql`TRUE`);
  const count = countRows[0]?.count ?? 0;

  // Fetch all criteria, evaluations, and scores to compute weighted ratings and breakdown
  const allCriteria = await db.select().from(criteria);
  const evaluationsRows = await db.select().from(evaluation);
  const scoresRows = await db.select().from(evaluationScore);

  const mainCriteria = allCriteria.filter(c => !c.parentId);
  const subCriteria = allCriteria.filter(c => c.parentId);

  const movieEvaluations: Record<string, string[]> = {};
  evaluationsRows.forEach(ev => {
    if (ev.movieId) {
      if (!movieEvaluations[ev.movieId]) movieEvaluations[ev.movieId] = [];
      movieEvaluations[ev.movieId]?.push(ev.id);
    }
  });

  const evalScores: Record<string, { criteriaId: string; score: number }[]> = {};
  scoresRows.forEach(s => {
    if (s.evaluationId) {
      if (!evalScores[s.evaluationId]) evalScores[s.evaluationId] = [];
      evalScores[s.evaluationId]?.push({ criteriaId: s.criteriaId ?? "", score: Number(s.score) });
    }
  });

  const weighted: Record<string, number> = {};
  const breakdown: Record<string, { name: string; value: number }[]> = {};
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
      weighted[mv.id] = Math.round((weightedSum / totalWeight) * 100) / 100;
    }
    breakdown[mv.id] = mainValues.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3);
  }

  return NextResponse.json({ movies, count, weighted, breakdown });
}
