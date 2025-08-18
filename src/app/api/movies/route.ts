import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { movie, movieWeightedCache } from "~/server/db/schema";
import { and, desc, eq, like, sql } from "drizzle-orm";
import { getServerAuth } from "~/server/auth";

export async function GET(request: Request) {
  const session = await getServerAuth();
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

  // Base filters
  const whereFilters = and(
    type ? eq(movie.type, type) : eq(movie.type, "movie"),
    search ? like(movie.title, `%${search}%`) : sql`TRUE`,
    yearFromNum !== undefined ? sql`${movie.year} >= ${yearFromNum}` : sql`TRUE`,
    yearToNum !== undefined ? sql`${movie.year} <= ${yearToNum}` : sql`TRUE`,
    director ? like(movie.director, `%${director}%`) : sql`TRUE`,
    actor ? like(movie.actors, `%${actor}%`) : sql`TRUE`,
    writer ? like(movie.writer, `%${writer}%`) : sql`TRUE`,
    genre ? like(movie.genre, `%${genre}%`) : sql`TRUE`
  );

  // Query with cached global weighted score
  const movies = await db
    .select({
      id: movie.id,
      title: movie.title,
      posterUrl: movie.posterUrl,
      genre: movie.genre,
      type: movie.type,
      director: movie.director,
      actors: movie.actors,
      year: movie.year,
      weightedScore: sql<number>`COALESCE(${movieWeightedCache.score}, 0)`
    })
    .from(movie)
    .leftJoin(movieWeightedCache, eq(movieWeightedCache.movieId, movie.id))
    .where(
      minRatingNum !== undefined
        ? and(whereFilters, sql`COALESCE(${movieWeightedCache.score}, 0) >= ${minRatingNum}`)
        : whereFilters
    )
    .orderBy(desc(movieWeightedCache.score))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const countRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(movie)
    .leftJoin(movieWeightedCache, eq(movieWeightedCache.movieId, movie.id))
    .where(
      minRatingNum !== undefined
        ? and(whereFilters, sql`COALESCE(${movieWeightedCache.score}, 0) >= ${minRatingNum}`)
        : whereFilters
    );
  const count = countRows[0]?.count ?? 0;

  return NextResponse.json({ movies, count });
}
