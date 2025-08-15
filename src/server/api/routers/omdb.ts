import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "~/env";
import { db } from "~/server/db";
import { movie } from "~/server/db/schema";
import { and, isNotNull, isNull } from "drizzle-orm";

const OmdbResponseSchema = z.object({
    Title: z.string(),
  Year: z.string(),
  Rated: z.string(),
  Released: z.string(),
  Runtime: z.string(),
  Genre: z.string(),
  Director: z.string(),
  Writer: z.string(),
  Actors: z.string(),
  Plot: z.string(),
  Language: z.string(),
  Country: z.string(),
  Awards: z.string(),
  Poster: z.string().url(),
  imdbID: z.string(),
  Type: z.string(),
  DVD: z.string(),
  BoxOffice: z.string(),
  Production: z.string(),
  Website: z.string(),
  Response: z.string()
});


export const omdbRouter = createTRPCRouter({
  getByTitle: publicProcedure
    .input(z.object({
      title: z.string().min(1, "Title is required"),
      year: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      if (!env.OMDB_API_KEY) {
        throw new Error("OMDb API key missing");
      }
    const BATCH_SIZE = 5;

const titles = await db
  .select({ title: movie.title, year: movie.year })
  .from(movie)
  .where(and(isNull(movie.posterUrl), isNotNull(movie.title)))

      const url = new URL("https://www.omdbapi.com/");
      url.searchParams.set("t", input.title ?? "");
      if (input.year) url.searchParams.set("y", input.year.toString() ?? "");
      url.searchParams.set("apikey", env.OMDB_API_KEY ?? "");

      const res = await fetch(url.toString());
      const data = await res.json() as Promise<{Poster: string}>;


      const parsed = OmdbResponseSchema.safeParse(data);
      if (!parsed.success) {
        return
      }

      const d = parsed.data;
      // Parse box office (e.g., "$1,234,567") to a cleaned string or null
      let boxOffice: string | null = null;
      if (d.BoxOffice && d.BoxOffice !== "N/A") {
        const cleaned = d.BoxOffice.replace(/\$/g, "").replace(/,/g, "");
        const numeric = Number(cleaned);
        boxOffice = Number.isNaN(numeric) ? null : cleaned;
      }

      // Parse year to number | null
      const yearNum = parseInt(d.Year, 10);
      const year = Number.isNaN(yearNum) ? null : yearNum;

      // Explicitly map OMDb response to our DB insert type
      const newData: typeof movie.$inferInsert = {
        title: d.Title,
        type: d.Type,
        year,
        genre: d.Genre,
        posterUrl: d.Poster,
        imdbID: d.imdbID,
        rated: d.Rated,
        released: d.Released,
        runtime: d.Runtime,
        director: d.Director,
        writer: d.Writer,
        actors: d.Actors,
        plot: d.Plot,
        language: d.Language,
        country: d.Country,
        awards: d.Awards,
        dvd: d.DVD,
        boxOffice,
        production: d.Production,
        website: d.Website,
        response: d.Response,
      };
      console.log(newData)

      await db
        .insert(movie)
        .values(newData)
        .onConflictDoUpdate({
          target: movie.title,
          set: newData,
        })
        .catch((err) => console.error(err))
        .finally(() => console.log(`Processed: ${input.title}`));

    return {data: {Poster: d.Poster}}
    })
});
