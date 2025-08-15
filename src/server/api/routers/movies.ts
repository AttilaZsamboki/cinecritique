import { db } from "~/server/db";
import { bestOf, evaluation, evaluationScore } from "~/server/db/schema";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { sql } from "drizzle-orm";
import { criteria } from "~/server/db/schema";
import { movie } from "~/server/db/schema";
import { movieCriteriaOverride, criteriaDefaultApplicability } from "~/server/db/schema";

export const movieRouter = createTRPCRouter({
  upsertEvaluationScore: publicProcedure
    .input(z.object({
      movieId: z.string(),
      criteriaId: z.string(),
      score: z.number().min(0).max(5),
    }))
    .mutation(async ({ input }) => {
      // Find or create evaluation for this movie (single-user, so just one evaluation per movie)
      let evalRow = await db.query.evaluation.findFirst({ where: (e, { eq }) => eq(e.movieId, input.movieId) });
      if (!evalRow) {
        const [newEval] = await db.insert(evaluation).values({
          movieId: input.movieId,
          date: new Date(),
        }).returning();
        evalRow = newEval;
      }
      if (!evalRow) throw new Error("Failed to create or find evaluation");
      // Upsert evaluationScore
      const existing = await db.query.evaluationScore.findFirst({
        where: (s, { eq, and }) => and(eq(s.evaluationId, evalRow.id), eq(s.criteriaId, input.criteriaId)),
      });
      if (existing) {
        await db.update(evaluationScore)
          .set({ score: input.score.toString() })
          .where(sql`id = ${existing.id}`);
      } else {
        await db.insert(evaluationScore).values({
          evaluationId: evalRow.id,
          criteriaId: input.criteriaId,
          score: input.score.toString(),
        });
      }
      return { success: true };
    }),
  // Best-of endpoints
  setBestOf: publicProcedure
    .input(z.object({ criteriaId: z.string(), movieId: z.string(), clipUrl: z.string().optional().nullable() }))
    .mutation(async ({ input }) => {
      // Upsert one global best for the criteria
      const existing = await db.query.bestOf.findFirst({ where: (b, { eq }) => eq(b.criteriaId, input.criteriaId) });
      if (existing) {
        await db.update(bestOf)
          .set({ movieId: input.movieId, clipUrl: input.clipUrl ?? null })
          .where(sql`id = ${existing.id}`);
      } else {
        await db.insert(bestOf).values({ criteriaId: input.criteriaId, movieId: input.movieId, clipUrl: input.clipUrl ?? null });
      }
      return { success: true };
    }),
  getBestOfForAll: publicProcedure
    .query(async () => {
      return db.select().from(bestOf);
    }),
  getBestOfForCriteria: publicProcedure
    .input(z.object({ criteriaId: z.string() }))
    .query(async ({ input }) => {
      return db.query.bestOf.findFirst({ where: (b, { eq }) => eq(b.criteriaId, input.criteriaId) });
    }),
  // Curated list (top-N) endpoints
  addToBestOfList: publicProcedure
    .input(z.object({ criteriaId: z.string(), movieId: z.string(), clipUrl: z.string().optional().nullable() }))
    .mutation(async ({ input }) => {
      const existingForCriteria = await db.query.bestOf.findMany({ where: (b, { eq }) => eq(b.criteriaId, input.criteriaId) });
      // If the movie already exists in the list, just update clip
      const existingMovie = existingForCriteria.find((r) => r.movieId === input.movieId);
      if (existingMovie) {
        await db.update(bestOf).set({ clipUrl: input.clipUrl ?? null }).where(sql`id = ${existingMovie.id}`);
        return { success: true };
      }
      const maxPos = existingForCriteria.reduce((acc, r) => Math.max(acc, r.position ?? -1), -1);
      await db.insert(bestOf).values({
        criteriaId: input.criteriaId,
        movieId: input.movieId,
        clipUrl: input.clipUrl ?? null,
        position: maxPos + 1,
      });
      return { success: true };
    }),
  replaceInBestOfList: publicProcedure
    .input(z.object({ criteriaId: z.string(), oldMovieId: z.string(), newMovieId: z.string() }))
    .mutation(async ({ input }) => {
      const row = await db.query.bestOf.findFirst({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.movieId, input.oldMovieId)) });
      if (!row) throw new Error("Old movie is not in the curated list");
      // If the new movie already exists, swap their movieIds by assigning new to this row and delete the duplicate
      const dup = await db.query.bestOf.findFirst({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.movieId, input.newMovieId)) });
      if (dup) {
        // Remove duplicate; keep current row and set its movieId to newMovieId
        await db.update(bestOf).set({ movieId: input.newMovieId }).where(sql`id = ${row.id}`);
        await db.delete(bestOf).where(sql`id = ${dup.id}`);
      } else {
        await db.update(bestOf).set({ movieId: input.newMovieId }).where(sql`id = ${row.id}`);
      }
      return { success: true };
    }),
  reorderBestOfList: publicProcedure
    .input(z.object({ criteriaId: z.string(), orderedMovieIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      // Fetch all rows for criteria
      const rows = await db.query.bestOf.findMany({ where: (b, { eq }) => eq(b.criteriaId, input.criteriaId) });
      // Map movieId -> row
      const map = new Map(rows.map((r) => [r.movieId!, r]));
      // Assign positions by order
      for (let i = 0; i < input.orderedMovieIds.length; i++) {
        const mid = input.orderedMovieIds[i];
        const r = map.get(mid);
        if (r) {
          await db.update(bestOf).set({ position: i }).where(sql`id = ${r.id}`);
        }
      }
      return { success: true };
    }),
  getBestOfListForCriteria: publicProcedure
    .input(z.object({ criteriaId: z.string() }))
    .query(async ({ input }) => {
      const rows = await db.query.bestOf.findMany({ where: (b, { eq }) => eq(b.criteriaId, input.criteriaId) });
      // Sort position asc (nulls last), then createdAt desc as tiebreaker
      return rows.sort((a, b) => {
        const pa = a.position ?? Number.MAX_SAFE_INTEGER;
        const pb = b.position ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dbt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dbt - da;
      });
    }),
  updateCriteriaWeight: publicProcedure
    .input(z.object({ id: z.string(), weight: z.number().min(0).max(100) }))
    .mutation(async ({ input }) => {
      await db.update(criteria)
        .set({ weight: input.weight })
        .where(sql`id = ${input.id}`);
      return { success: true };
    }),
  updateCriteriaWeights: publicProcedure
    .input(z.object({ updates: z.array(z.object({ id: z.string(), weight: z.number().min(0).max(100) })) }))
    .mutation(async ({ input }) => {
      for (const u of input.updates) {
        await db.update(criteria).set({ weight: u.weight }).where(sql`id = ${u.id}`);
      }
      return { success: true };
    }),
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.query.movie.findFirst({ where: (m, { eq }) => eq(m.id, input.id) });
    }),
  getAllCriteria: publicProcedure
    .query(async () => {
      return db.select().from(criteria);
    }),
  createCriteria: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      weight: z.number().min(0).max(100).default(0),
      parentId: z.string().optional().nullable(),
      position: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ input }) => {
      const siblingCount = await db.query.criteria.findMany({ where: (c, { eq }) => eq(c.parentId, input.parentId ?? "") });
      const pos = input.position ?? siblingCount.length;
      const [row] = await db.insert(criteria).values({
        name: input.name,
        description: input.description ?? null,
        weight: input.weight,
        parentId: input.parentId ?? null,
        position: pos,
      }).returning();
      return row;
    }),
  updateCriteria: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
      weight: z.number().min(0).max(100).optional(),
    }))
    .mutation(async ({ input }) => {
      await db.update(criteria)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.weight !== undefined ? { weight: input.weight } : {}),
        })
        .where(sql`id = ${input.id}`);
      return { success: true };
    }),
  deleteCriteria: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Delete all sub-criteria first (cascade manually)
      const subs = await db.query.criteria.findMany({ where: (c, { eq }) => eq(c.parentId, input.id) });
      for (const s of subs) {
        await db.delete(criteria).where(sql`id = ${s.id}`);
      }
      await db.delete(criteria).where(sql`id = ${input.id}`);
      return { success: true };
    }),
  reorderCriteria: publicProcedure
    .input(z.object({
      parentId: z.string().optional().nullable(),
      orderedIds: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      // Assign position by index in orderedIds
      for (let i = 0; i < input.orderedIds.length; i++) {
        const id = input.orderedIds[i];
        await db.update(criteria).set({ position: i, parentId: input.parentId ?? null }).where(sql`id = ${id}`);
      }
      return { success: true };
    }),
  getEvaluationsByMovie: publicProcedure
    .input(z.object({ movieId: z.string() }))
    .query(async ({ input }) => {
      return db.query.evaluation.findMany({ where: (e, { eq }) => eq(e.movieId, input.movieId) });
    }),
  getScoresByEvaluationIds: publicProcedure
    .input(z.object({ evalIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.evalIds.length === 0) return [];
      return db.query.evaluationScore.findMany({ where: (s, { inArray }) => inArray(s.evaluationId, input.evalIds) });
    }),
  createMovie: publicProcedure
    .input(z.object({ title: z.string().optional().nullable(), year: z.number().optional().nullable(), genre: z.string().optional().nullable(), type: z.string().optional().nullable(), posterUrl: z.string().url().optional().nullable()}))
    .mutation(async ({ input }) => {
      return db.insert(movie).values(input).returning()
    }
    )
  ,
  updateMoviePoster: publicProcedure
    .input(z.object({ id: z.string(), posterUrl: z.string().url().optional().nullable() }))
    .mutation(async ({ input }) => {
      await db.update(movie)
        .set({ posterUrl: input.posterUrl ?? null })
        .where(sql`id = ${input.id}`);
      return { success: true };
    }),
  searchMovies: publicProcedure
    .input(z.object({ q: z.string().min(1), limit: z.number().int().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      const q = input.q.trim().toLowerCase();
      const lim = input.limit ?? 10;
      if (!q) return [];
      // Case-insensitive contains match over title
      const rows = await db.select().from(movie).where(sql`lower(${movie.title}) like ${`%${q}%`}`).limit(lim);
      return rows;
    }),

  // Compute applicable criteria for a given movie (defaults + per-movie overrides)
  getApplicableCriteriaForMovie: publicProcedure
    .input(z.object({ movieId: z.string() }))
    .query(async ({ input }) => {
      const mv = await db.query.movie.findFirst({ where: (m, { eq }) => eq(m.id, input.movieId) });
      if (!mv) throw new Error("Movie not found");
      const allCriteria = await db.select().from(criteria);
      const overrides = await db.query.movieCriteriaOverride.findMany({ where: (o, { eq }) => eq(o.movieId, input.movieId) });
      const defaults = await db.query.criteriaDefaultApplicability.findMany();

      // Build quick maps
      const overrideMap = new Map(overrides.map((o) => [o.criteriaId!, o.mode!] as const));
      const defaultMap = new Map(defaults.map((d) => [d.criteriaId!, d] as const));

      const parseCsv = (csv?: string | null) =>
        (csv ?? "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

      const mvType = (mv.type ?? "").toLowerCase();
      const mvGenres = parseCsv(mv.genre);

      const applicable = allCriteria.filter((c) => {
        const cid = c.id!;
        // Start with default: include unless defaultMode === 'exclude'
        const d = defaultMap.get(cid);
        let include = (d?.defaultMode ?? "include").toLowerCase() !== "exclude";
        if (d) {
          const incTypes = parseCsv(d.includeTypesCsv);
          const excTypes = parseCsv(d.excludeTypesCsv);
          const incGenres = parseCsv(d.includeGenresCsv);
          const excGenres = parseCsv(d.excludeGenresCsv);

          if (incTypes.length > 0) include = incTypes.includes(mvType);
          if (excTypes.length > 0 && excTypes.includes(mvType)) include = false;

          if (incGenres.length > 0) include = incGenres.some((g) => mvGenres.includes(g));
          if (excGenres.length > 0 && excGenres.some((g) => mvGenres.includes(g))) include = false;
        }
        // Apply override last
        const ov = overrideMap.get(cid);
        if (ov) include = ov === "include";
        return include;
      });

      return applicable;
    }),

  // Upsert a per-movie criteria override
  setMovieCriteriaOverride: publicProcedure
    .input(z.object({ movieId: z.string(), criteriaId: z.string(), mode: z.enum(["include", "exclude"]) }))
    .mutation(async ({ input }) => {
      const existing = await db.query.movieCriteriaOverride.findFirst({
        where: (o, { and, eq }) => and(eq(o.movieId, input.movieId), eq(o.criteriaId, input.criteriaId)),
      });
      if (existing) {
        await db.update(movieCriteriaOverride)
          .set({ mode: input.mode })
          .where(sql`id = ${existing.id}`);
      } else {
        await db.insert(movieCriteriaOverride).values({ movieId: input.movieId, criteriaId: input.criteriaId, mode: input.mode });
      }
      return { success: true };
    }),

  // Upsert a criteria default applicability rule (single row per criteriaId in practice)
  setCriteriaDefaultApplicability: publicProcedure
    .input(z.object({
      criteriaId: z.string(),
      defaultMode: z.enum(["include", "exclude"]).optional().nullable(),
      includeTypesCsv: z.string().optional().nullable(),
      excludeTypesCsv: z.string().optional().nullable(),
      includeGenresCsv: z.string().optional().nullable(),
      excludeGenresCsv: z.string().optional().nullable(),
    }))
    .mutation(async ({ input }) => {
      const existing = await db.query.criteriaDefaultApplicability.findFirst({
        where: (d, { eq }) => eq(d.criteriaId, input.criteriaId),
      });
      const payload = {
        defaultMode: input.defaultMode ?? null,
        includeTypesCsv: input.includeTypesCsv ?? null,
        excludeTypesCsv: input.excludeTypesCsv ?? null,
        includeGenresCsv: input.includeGenresCsv ?? null,
        excludeGenresCsv: input.excludeGenresCsv ?? null,
      };
      if (existing) {
        await db.update(criteriaDefaultApplicability).set(payload).where(sql`id = ${existing.id}`);
      } else {
        await db.insert(criteriaDefaultApplicability).values({ criteriaId: input.criteriaId, ...payload });
      }
      return { success: true };
    }),
});
