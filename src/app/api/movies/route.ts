import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { evaluation, evaluationScore, criteria, movie, movieWeightedCache } from "~/server/db/schema";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { computeWeightedScores } from "~/server/score";
import { auth } from "~/server/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id as string;
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
            WHERE e.movie_id = ${sql`${movie.id}`} AND e.user_id = ${userId}
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
    .select({
      id: moviesWithRatings.id,
      title: moviesWithRatings.title,
      posterUrl: moviesWithRatings.posterUrl,
      genre: moviesWithRatings.genre,
      type: moviesWithRatings.type,
      director: moviesWithRatings.director,
      actors: moviesWithRatings.actors,
      year: moviesWithRatings.year,
      rating: moviesWithRatings.rating,
    })
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
  const evaluationsRows = await db.select().from(evaluation).where(eq(evaluation.userId, userId));
  const scoresRows = await db.select().from(evaluationScore);

  const { weighted, breakdown } = computeWeightedScores({
    criteria: allCriteria,
    evaluations: evaluationsRows,
    scores: scoresRows,
    movieIds: movies.map((m) => m.id),
    includeBreakdown: true,
  });

  return NextResponse.json({ movies, count, weighted, breakdown });
}
