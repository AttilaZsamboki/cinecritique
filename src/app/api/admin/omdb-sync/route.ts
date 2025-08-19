import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { movie } from "~/server/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getServerAuth } from "~/server/auth";

// Minimal OMDb response typing
type OmdbResponse = {
  Response: "True" | "False";
  Error?: string;
  Title?: string;
  Year?: string;
  Rated?: string;
  Released?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Writer?: string;
  Actors?: string;
  Plot?: string;
  Language?: string;
  Country?: string;
  Awards?: string;
  Poster?: string;
  imdbID?: string;
  DVD?: string;
  BoxOffice?: string;
  Production?: string;
  Website?: string;
};

export async function POST(request: Request) {
  const session = await getServerAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 500);
  const missingOnly = (searchParams.get("missingOnly") || "true") === "true";

  const OMDB_API_KEY = process.env.OMDB_API_KEY;
  if (!OMDB_API_KEY) {
    return NextResponse.json({ error: "OMDB_API_KEY not set" }, { status: 400 });
  }

  // Find candidate movies
  const where = missingOnly
    ? and(
        // any of the common fields missing
        sql`${movie.posterUrl} IS NULL OR ${movie.posterUrl} = '' OR ${movie.imdbID} IS NULL OR ${movie.imdbID} = '' OR ${movie.genre} IS NULL OR ${movie.genre} = ''`
      )
    : sql`TRUE`;

  const candidates = await db
    .select({ id: movie.id, title: movie.title, year: movie.year })
    .from(movie)
    .where(where)
    .limit(limit);

  let updated = 0;
  const errors: Array<{ id: string; reason: string }> = [];

  for (const m of candidates) {
    const title = m.title || "";
    const y = m.year ? `&y=${m.year}` : "";
    const url = `https://www.omdbapi.com/?t=${encodeURIComponent(title)}${y}&apikey=${OMDB_API_KEY}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json()) as OmdbResponse;
      if (data.Response === "False") {
        errors.push({ id: m.id, reason: data.Error || "OMDb not found" });
        continue;
      }
      await db
        .update(movie)
        .set({
          posterUrl: data.Poster && data.Poster !== "N/A" ? data.Poster : sql`COALESCE(${movie.posterUrl}, ${''})`,
          imdbID: data.imdbID && data.imdbID !== "N/A" ? data.imdbID : sql`COALESCE(${movie.imdbID}, ${''})`,
          genre: data.Genre && data.Genre !== "N/A" ? data.Genre : sql`COALESCE(${movie.genre}, ${''})`,
          rated: data.Rated && data.Rated !== "N/A" ? data.Rated : sql`COALESCE(${movie.rated}, ${''})`,
          released: data.Released && data.Released !== "N/A" ? data.Released : sql`COALESCE(${movie.released}, ${''})`,
          runtime: data.Runtime && data.Runtime !== "N/A" ? data.Runtime : sql`COALESCE(${movie.runtime}, ${''})`,
          director: data.Director && data.Director !== "N/A" ? data.Director : sql`COALESCE(${movie.director}, ${''})`,
          writer: data.Writer && data.Writer !== "N/A" ? data.Writer : sql`COALESCE(${movie.writer}, ${''})`,
          actors: data.Actors && data.Actors !== "N/A" ? data.Actors : sql`COALESCE(${movie.actors}, ${''})`,
          plot: data.Plot && data.Plot !== "N/A" ? data.Plot : sql`COALESCE(${movie.plot}, ${''})`,
          language: data.Language && data.Language !== "N/A" ? data.Language : sql`COALESCE(${movie.language}, ${''})`,
          country: data.Country && data.Country !== "N/A" ? data.Country : sql`COALESCE(${movie.country}, ${''})`,
          awards: data.Awards && data.Awards !== "N/A" ? data.Awards : sql`COALESCE(${movie.awards}, ${''})`,
          dvd: data.DVD && data.DVD !== "N/A" ? data.DVD : sql`COALESCE(${movie.dvd}, ${''})`,
          boxOffice: data.BoxOffice && data.BoxOffice !== "N/A" ? data.BoxOffice : sql`COALESCE(${movie.boxOffice}, ${''})`,
          production: data.Production && data.Production !== "N/A" ? data.Production : sql`COALESCE(${movie.production}, ${''})`,
          website: data.Website && data.Website !== "N/A" ? data.Website : sql`COALESCE(${movie.website}, ${''})`,
          response: data.Response,
        })
        .where(eq(movie.id, m.id));
      updated++;
    } catch (e: any) {
      errors.push({ id: m.id, reason: e?.message || "fetch failed" });
    }
  }

  return NextResponse.json({ scanned: candidates.length, updated, errors });
}
