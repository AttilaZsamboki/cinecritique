import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { sql } from "drizzle-orm";
import { getServerAuth } from "~/server/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // Create indexes and cache table if not exist (idempotent)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_movie_title ON cinecritique_movie (title);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_movie_year ON cinecritique_movie (year);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_movie_genre ON cinecritique_movie (genre);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_evaluation_movie_id ON cinecritique_evaluation (movie_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_score_eval_id ON cinecritique_evaluation_score (evaluation_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_eval_score_criteria_id ON cinecritique_evaluation_score (criteria_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_criteria_parent ON cinecritique_criteria (parent_id);`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cinecritique_movie_weighted_cache (
      movie_id text PRIMARY KEY REFERENCES cinecritique_movie(id),
      score numeric(3,1) NOT NULL,
      breakdown_json text
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_movie_weighted_score ON cinecritique_movie_weighted_cache (score DESC);`);

  return NextResponse.json({ ok: true });
}
