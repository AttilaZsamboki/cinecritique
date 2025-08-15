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
  .where(and(isNull(movie.posterUrl), isNotNull(movie.title)));

for (let i = 0; i < titles.length; i += BATCH_SIZE) {
  const batch = titles.slice(i, i + BATCH_SIZE);

  await Promise.all(
    batch.map(async (title) => {
      const url = new URL("https://www.omdbapi.com/");
      url.searchParams.set("t", title.title ?? "");
      if (title.year) url.searchParams.set("y", title.year.toString() ?? "");
      url.searchParams.set("apikey", env.OMDB_API_KEY);

      const res = await fetch(url.toString());
      const data = await res.json();


      const parsed = OmdbResponseSchema.safeParse(data);
      if (!parsed.success) {
        console.log(title, parsed.error)
        return
      }

      const new_data = Object.fromEntries(
        Object.entries(parsed.data).map(([key, value]) => {
          let k = key.toLowerCase();
          if (key === "Year") {
            k = parseInt(k ?? "") as unknown as string;
          }
          return [k, value];
        })
      );

      new_data["posterUrl"] = (new_data as unknown as { poster: string }).poster;

      await db
        .insert(movie)
        .values(new_data)
        .onConflictDoUpdate({
          target: movie.title,
          set: new_data,
        })
        .catch((err) => console.error(err))
        .finally(() => console.log(`Processed: ${title.title}`));
    })
  );
}
return {"data": {"Poster": ""}}
})
})
