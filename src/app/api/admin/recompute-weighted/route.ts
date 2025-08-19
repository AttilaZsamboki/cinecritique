import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { criteria, evaluation, evaluationScore, movie, movieWeightedCache } from "~/server/db/schema";
import { computeWeightedScores } from "~/server/score";
import { getServerAuth } from "~/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Load everything
  const allCriteria = await db.select().from(criteria);
  const evaluations = await db.select().from(evaluation);
  const scores = await db.select().from(evaluationScore);
  const movies = await db.select().from(movie);

  // Compute weighted for all movies with breakdown
  const { weighted, breakdown } = computeWeightedScores({
    criteria: allCriteria,
    evaluations,
    scores,
    movieIds: movies.map((m) => m.id),
    includeBreakdown: true,
  });

  // Upsert into cache
  for (const m of movies) {
    const w = weighted[m.id];
    if (w == null) continue;
    const b = breakdown[m.id] ?? [];
    const scoreStr = Number(w.toFixed(1)).toString();
    await db
      .insert(movieWeightedCache)
      .values({ movieId: m.id, score: scoreStr, breakdownJson: JSON.stringify(b) })
      .onConflictDoUpdate({
        target: movieWeightedCache.movieId,
        set: {
          score: scoreStr,
          breakdownJson: JSON.stringify(b),
        },
      });
  }

  return NextResponse.json({ updated: Object.keys(weighted).length });
}
