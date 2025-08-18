import { db } from "~/server/db";
import { bestOf, evaluation, evaluationScore } from "~/server/db/schema";
import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { sql } from "drizzle-orm";
import { criteria } from "~/server/db/schema";
import { movie } from "~/server/db/schema";
import { movieCriteriaOverride, criteriaDefaultApplicability } from "~/server/db/schema";

export const movieRouter = createTRPCRouter({
  upsertEvaluationScore: protectedProcedure
    .input(z.object({
      movieId: z.string(),
      criteriaId: z.string(),
      score: z.number().min(0).max(5),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      // Find or create evaluation for this movie scoped to user
      let evalRow = await db.query.evaluation.findFirst({ where: (e, { eq, and }) => and(eq(e.movieId, input.movieId), eq(e.userId, userId)) });
      if (!evalRow) {
        const [newEval] = await db.insert(evaluation).values({
          movieId: input.movieId,
          date: new Date(),
          userId,
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

  // List overrides for a movie
  getMovieCriteriaOverrides: protectedProcedure
    .input(z.object({ movieId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      return db.query.movieCriteriaOverride.findMany({ where: (o, { and, eq }) => and(eq(o.movieId, input.movieId), eq(o.userId, userId)) });
    }),

  // Clear override (delete) for a movie+criteria
  clearMovieCriteriaOverride: protectedProcedure
    .input(z.object({ movieId: z.string(), criteriaId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      const existing = await db.query.movieCriteriaOverride.findFirst({
        where: (o, { and, eq }) => and(eq(o.movieId, input.movieId), eq(o.criteriaId, input.criteriaId), eq(o.userId, userId)),
      });
      if (existing) {
        await db.delete(movieCriteriaOverride).where(sql`id = ${existing.id}`);
      }
      return { success: true };
    }),
  // Best-of endpoints
  setBestOf: protectedProcedure
    .input(z.object({ criteriaId: z.string(), movieId: z.string(), clipUrl: z.string().optional().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      // Upsert one per-user best for the criteria
      const existing = await db.query.bestOf.findFirst({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.userId, userId)) });
      if (existing) {
        await db.update(bestOf)
          .set({ movieId: input.movieId, clipUrl: input.clipUrl ?? null })
          .where(sql`id = ${existing.id}`);
      } else {
        await db.insert(bestOf).values({ criteriaId: input.criteriaId, movieId: input.movieId, clipUrl: input.clipUrl ?? null, userId });
      }
      return { success: true };
    }),
  getBestOfForAll: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session!.user!.id as string;
      return db.query.bestOf.findMany({ where: (b, { eq }) => eq(b.userId, userId) });
    }),
  getBestOfForCriteria: protectedProcedure
    .input(z.object({ criteriaId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      return db.query.bestOf.findFirst({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.userId, userId)) });
    }),
  // Curated list (top-N) endpoints
  addToBestOfList: protectedProcedure
    .input(z.object({ criteriaId: z.string(), movieId: z.string(), clipUrl: z.string().optional().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      const existingForCriteria = await db.query.bestOf.findMany({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.userId, userId)) });
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
        userId,
      });
      return { success: true };
    }),
  replaceInBestOfList: protectedProcedure
    .input(z.object({ criteriaId: z.string(), oldMovieId: z.string(), newMovieId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      const row = await db.query.bestOf.findFirst({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.movieId, input.oldMovieId), eq(b.userId, userId)) });
      if (!row) throw new Error("Old movie is not in the curated list");
      // If the new movie already exists, swap their movieIds by assigning new to this row and delete the duplicate
      const dup = await db.query.bestOf.findFirst({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.movieId, input.newMovieId), eq(b.userId, userId)) });
      if (dup) {
        // Remove duplicate; keep current row and set its movieId to newMovieId
        await db.update(bestOf).set({ movieId: input.newMovieId }).where(sql`id = ${row.id}`);
        await db.delete(bestOf).where(sql`id = ${dup.id}`);
      } else {
        await db.update(bestOf).set({ movieId: input.newMovieId }).where(sql`id = ${row.id}`);
      }
      return { success: true };
    }),
  reorderBestOfList: protectedProcedure
    .input(z.object({ criteriaId: z.string(), orderedMovieIds: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      // Fetch all rows for criteria
      const rows = await db.query.bestOf.findMany({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.userId, userId)) });
      // Map movieId -> row (guard against null movieId)
      const map = new Map<string, typeof rows[number]>()
      for (const r of rows) {
        if (r.movieId) map.set(r.movieId, r);
      }
      // Assign positions by order
      for (let i = 0; i < input.orderedMovieIds.length; i++) {
        const mid = input.orderedMovieIds[i];
        const r = map.get(mid ?? "");
        if (r) {
          await db.update(bestOf).set({ position: i }).where(sql`id = ${r.id}`);
        }
      }
      return { success: true };
    }),
  getBestOfListForCriteria: protectedProcedure
    .input(z.object({ criteriaId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      const rows = await db.query.bestOf.findMany({ where: (b, { and, eq }) => and(eq(b.criteriaId, input.criteriaId), eq(b.userId, userId)) });
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
      // Prevent deleting if referenced or if it has subs
      const subs = await db.query.criteria.findMany({ where: (c, { eq }) => eq(c.parentId, input.id) });
      if (subs.length > 0) {
        throw new Error("Cannot delete: criterion has sub-criteria.");
      }
      const refCounts = await Promise.all([
        db.query.evaluationScore.findMany({ where: (s, { eq }) => eq(s.criteriaId, input.id) }),
        db.query.bestOf.findMany({ where: (b, { eq }) => eq(b.criteriaId, input.id) }),
        db.query.movieCriteriaOverride.findMany({ where: (o, { eq }) => eq(o.criteriaId, input.id) }),
        db.query.criteriaDefaultApplicability.findMany({ where: (d, { eq }) => eq(d.criteriaId, input.id) }),
      ]);
      const referenced = refCounts.some(arr => arr.length > 0);
      if (referenced) {
        throw new Error("Cannot delete: criterion is referenced in scores, best-of, overrides, or defaults.");
      }
      await db.delete(criteria).where(sql`id = ${input.id}`);
      return { success: true };
    }),
  // Force delete: remove references from dependent tables, then delete the criterion.
  deleteCriteriaForce: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Still do not allow deleting mains that have subs.
      const subs = await db.query.criteria.findMany({ where: (c, { eq }) => eq(c.parentId, input.id) });
      if (subs.length > 0) {
        throw new Error("Cannot force delete: criterion has sub-criteria. Delete subs first.");
      }
      // Remove references
      await db.delete(evaluationScore).where(sql`criteria_id = ${input.id}`);
      await db.delete(bestOf).where(sql`criteria_id = ${input.id}`);
      await db.delete(movieCriteriaOverride).where(sql`criteria_id = ${input.id}`);
      await db.delete(criteriaDefaultApplicability).where(sql`criteria_id = ${input.id}`);
      // Delete the criterion itself
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
  getEvaluationsByMovie: protectedProcedure
    .input(z.object({ movieId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      return db.query.evaluation.findMany({ where: (e, { and, eq }) => and(eq(e.movieId, input.movieId), eq(e.userId, userId)) });
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
      const overrideMap = new Map<string, string>();
      for (const o of overrides) {
        if (o.criteriaId && o.mode) overrideMap.set(o.criteriaId, o.mode);
      }
      const defaultMap = new Map<string, typeof defaults[number]>();
      for (const d of defaults) {
        if (d.criteriaId) defaultMap.set(d.criteriaId, d);
      }

      const parseCsv = (csv?: string | null) =>
        (csv ?? "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);

      const mvType = (mv.type ?? "").toLowerCase();
      const mvGenres = parseCsv(mv.genre);

      const applicable = allCriteria.filter((c) => {
        const cid = c.id;
        if (!cid) return false;
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
  setMovieCriteriaOverride: protectedProcedure
    .input(z.object({ movieId: z.string(), criteriaId: z.string(), mode: z.enum(["include", "exclude"]) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session!.user!.id as string;
      const existing = await db.query.movieCriteriaOverride.findFirst({
        where: (o, { and, eq }) => and(eq(o.movieId, input.movieId), eq(o.criteriaId, input.criteriaId), eq(o.userId, userId)),
      });
      if (existing) {
        await db.update(movieCriteriaOverride)
          .set({ mode: input.mode })
          .where(sql`id = ${existing.id}`);
      } else {
        await db.insert(movieCriteriaOverride).values({ movieId: input.movieId, criteriaId: input.criteriaId, mode: input.mode, userId });
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

  // List all default applicability rules
  getCriteriaDefaultApplicability: publicProcedure
    .query(async () => {
      return db.select().from(criteriaDefaultApplicability);
    }),

  // Reference info for criteria: whether it has subs or is referenced elsewhere
  getCriteriaReferenceInfo: publicProcedure
    .query(async () => {
      const all = await db.select().from(criteria);
      const info: Record<string, { hasSubs: boolean; referenced: boolean }> = {};
      const subsByParent = new Map<string, number>();
      for (const c of all) {
        if (c.parentId) subsByParent.set(c.parentId, (subsByParent.get(c.parentId) ?? 0) + 1);
      }
      // Collect referenced IDs from other tables
      const [scores, bests, overrides, defaults] = await Promise.all([
        db.select().from(evaluationScore),
        db.select().from(bestOf),
        db.select().from(movieCriteriaOverride),
        db.select().from(criteriaDefaultApplicability),
      ]);
      const referencedIds = new Set<string>();
      for (const r of scores) if (r.criteriaId) referencedIds.add(r.criteriaId);
      for (const r of bests) if (r.criteriaId) referencedIds.add(r.criteriaId);
      for (const r of overrides) if (r.criteriaId) referencedIds.add(r.criteriaId);
      for (const r of defaults) if (r.criteriaId) referencedIds.add(r.criteriaId);
      for (const c of all) {
        const id = c.id;
        info[id] = { hasSubs: (subsByParent.get(id) ?? 0) > 0, referenced: referencedIds.has(id) };
      }
      return info;
    }),

  // Update movie type and genre
  updateMovieMeta: publicProcedure
    .input(z.object({ id: z.string(), type: z.string().optional().nullable(), genre: z.string().optional().nullable() }))
    .mutation(async ({ input }) => {
      await db.update(movie)
        .set({ type: input.type ?? null, genre: input.genre ?? null })
        .where(sql`id = ${input.id}`);
      return { success: true };
    }),

  // Force delete a movie and clean up all references
  deleteMovieForce: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      // Delete bestOf entries referencing this movie
      await db.delete(bestOf).where(sql`movie_id = ${input.id}`);

      // Delete per-movie criteria overrides
      await db.delete(movieCriteriaOverride).where(sql`movie_id = ${input.id}`);

      // Delete evaluation scores for all evaluations of this movie
      const evals = await db.query.evaluation.findMany({ where: (e, { eq }) => eq(e.movieId, input.id) });
      for (const ev of evals) {
        if (ev.id) {
          await db.delete(evaluationScore).where(sql`evaluation_id = ${ev.id}`);
        }
      }

      // Delete evaluations for this movie
      await db.delete(evaluation).where(sql`movie_id = ${input.id}`);

      // Finally delete the movie itself
      await db.delete(movie).where(sql`id = ${input.id}`);
      return { success: true };
    }),

  // Compute top people by role, with averages and best movie poster
  getTopPeopleByRole: publicProcedure
    .input(z.object({
      role: z.enum(["actor", "writer", "director"]),
      page: z.number().int().min(1).optional().default(1),
      pageSize: z.number().int().min(1).max(100).optional().default(20),
      minMovies: z.number().int().min(1).optional().default(1),
      // For actors, specify which sub-criteria to average (e.g., "Performance Quality" id)
      actorCriteriaId: z.string().optional().nullable(),
      sortBy: z.enum(["avg", "count"]).optional().default("avg"),
      sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
    }))
    .query(async ({ input }) => {
      // Load required data
      const [allCriteria, allMovies, evaluations, scores] = await Promise.all([
        db.select().from(criteria),
        db.select().from(movie),
        db.select().from(evaluation),
        db.select().from(evaluationScore),
      ]);

      // Organize criteria
      const mainCriteria = allCriteria.filter((c) => !c.parentId);
      const subCriteria = allCriteria.filter((c) => c.parentId);

      // Index scores by evaluationId
      const evalScores: Record<string, { criteriaId: string; score: number }[]> = {};
      for (const s of scores) {
        if (s.evaluationId && s.criteriaId != null && s.score != null) {
          const arr = (evalScores[s.evaluationId] ||= []);
          arr.push({ criteriaId: s.criteriaId, score: Number(s.score) });
        }
      }

      // Map movie -> evaluation ids
      const movieEvaluations: Record<string, string[]> = {};
      for (const ev of evaluations) {
        if (ev.movieId && ev.id) {
          const arr = (movieEvaluations[ev.movieId] ||= []);
          arr.push(ev.id);
        }
      }

      // Overall weighted score per movie (0-5)
      const movieScores: Record<string, number> = {};
      for (const mv of allMovies) {
        const evalIds = movieEvaluations[mv.id ?? ""] || [];
        let weightedSum = 0;
        let totalWeight = 0;
        for (const main of mainCriteria) {
          const subs = subCriteria.filter((sc) => sc.parentId === main.id);
          let subWeightedSum = 0;
          let subTotalWeight = 0;
          for (const sub of subs) {
            const subScores: number[] = [];
            for (const evalId of evalIds) {
              const scoresForEval = evalScores[evalId] || [];
              const found = scoresForEval.find((s) => s.criteriaId === sub.id);
              if (found) subScores.push(found.score);
            }
            if (subScores.length > 0 && (sub.weight ?? 0) > 0) {
              const avg = subScores.reduce((a, b) => a + b, 0) / subScores.length;
              subWeightedSum += avg * (sub.weight ?? 0);
              subTotalWeight += sub.weight ?? 0;
            }
          }
          if (subTotalWeight > 0 && (main.weight ?? 0) > 0) {
            const mainValue = subWeightedSum / subTotalWeight;
            weightedSum += mainValue * (main.weight ?? 0);
            totalWeight += main.weight ?? 0;
          }
        }
        if (totalWeight > 0) movieScores[mv.id ?? ""] = weightedSum / totalWeight;
      }

      // For actors: compute per-movie average for a specific sub-criteria id if provided
      const actorSubScoreByMovie: Record<string, number | undefined> = {};
      if (input.role === "actor" && input.actorCriteriaId) {
        const targetId = input.actorCriteriaId;
        for (const mv of allMovies) {
          const evalIds = movieEvaluations[mv.id ?? ""] || [];
          const vals: number[] = [];
          for (const eid of evalIds) {
            const sarr = evalScores[eid] || [];
            const f = sarr.find((s) => s.criteriaId === targetId);
            if (f) vals.push(f.score);
          }
          if (vals.length > 0) actorSubScoreByMovie[mv.id ?? ""] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }

      // Helper: split CSV names into an array of normalized names
      const splitCsv = (s?: string | null) =>
        (s ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter((x) => x.length > 0);

      type PersonAgg = {
        name: string;
        total: number; // sum of scores
        count: number; // number of movies counted
        bestMovieId?: string;
        bestMovieTitle?: string | null;
        bestPosterUrl?: string | null;
        bestScore?: number;
      };

      const people: Record<string, PersonAgg> = {};
      for (const mv of allMovies) {
        const mvId = mv.id ?? "";
        let scoreForRole: number | undefined;
        if (input.role === "actor") {
          scoreForRole = input.actorCriteriaId ? actorSubScoreByMovie[mvId] : movieScores[mvId];
        } else {
          scoreForRole = movieScores[mvId];
        }
        if (scoreForRole == null) continue;

        let names: string[] = [];
        if (input.role === "actor") names = splitCsv(mv.actors);
        else if (input.role === "writer") names = splitCsv(mv.writer);
        else if (input.role === "director") names = splitCsv(mv.director);

        for (const name of names) {
          const key = name; // keep original casing for display
          if (!people[key]) {
            people[key] = { name: key, total: 0, count: 0 };
          }
          const agg = people[key];
          agg.total += scoreForRole;
          agg.count += 1;
          if (agg.bestScore == null || scoreForRole > agg.bestScore) {
            agg.bestScore = scoreForRole;
            agg.bestMovieId = mv.id ?? undefined;
            agg.bestMovieTitle = mv.title ?? null;
            agg.bestPosterUrl = mv.posterUrl ?? null;
          }
        }
      }

      // Build list and filter by minMovies
      const list = Object.values(people).filter((p) => p.count >= (input.minMovies ?? 1));

      // Compute averages
      const items = list.map((p) => ({
        name: p.name,
        avg: p.count > 0 ? p.total / p.count : 0,
        count: p.count,
        bestMovieId: p.bestMovieId,
        bestMovieTitle: p.bestMovieTitle,
        bestPosterUrl: p.bestPosterUrl,
        bestScore: p.bestScore,
      }));

      // Sorting
      items.sort((a, b) => {
        const dir = input.sortDir === "asc" ? 1 : -1;
        if (input.sortBy === "count") {
          if (a.count !== b.count) return dir * (a.count - b.count);
          if (a.avg !== b.avg) return dir * (a.avg - b.avg);
        } else {
          if (a.avg !== b.avg) return dir * (a.avg - b.avg);
          if (a.count !== b.count) return dir * (a.count - b.count);
        }
        return a.name.localeCompare(b.name);
      });

      const total = items.length;
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 20;
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const pageItems = items.slice(start, end);

      return { total, page, pageSize, items: pageItems };
    }),

  // Get most prestigious movies based on Best Of appearances with weighted scoring
  getMostPrestigiousMovies: publicProcedure
    .input(z.object({
      limit: z.number().int().min(1).max(100).optional().default(50),
    }))
    .query(async ({ input }) => {
      // Get all Best Of entries with their criteria and movie info
      const bestOfEntries = await db.select({
        movieId: bestOf.movieId,
        criteriaId: bestOf.criteriaId,
        position: bestOf.position,
        criteriaName: criteria.name,
        movieTitle: movie.title,
        movieYear: movie.year,
        moviePosterUrl: movie.posterUrl,
      })
      .from(bestOf)
      .innerJoin(criteria, sql`${bestOf.criteriaId} = ${criteria.id}`)
      .innerJoin(movie, sql`${bestOf.movieId} = ${movie.id}`)
      .where(sql`${bestOf.movieId} IS NOT NULL AND ${bestOf.criteriaId} IS NOT NULL`);

      // Calculate prestige scores for each movie
      const moviePrestige: Record<string, {
        movieId: string;
        title: string | null;
        year: number | null;
        posterUrl: string | null;
        totalScore: number;
        appearances: Array<{
          criteriaId: string;
          criteriaName: string | null;
          position: number;
          score: number;
        }>;
      }> = {};

      for (const entry of bestOfEntries) {
        if (!entry.movieId) continue;

        // Calculate weighted score: position 1 = 10 points, position 2 = 9 points, etc.
        // Position 10+ = 1 point minimum
        const position = entry.position ?? 10;
        const score = Math.max(11 - position, 1);

        if (!moviePrestige[entry.movieId]) {
          moviePrestige[entry.movieId] = {
            movieId: entry.movieId,
            title: entry.movieTitle,
            year: entry.movieYear,
            posterUrl: entry.moviePosterUrl,
            totalScore: 0,
            appearances: [],
          };
        }

        moviePrestige[entry.movieId]!.totalScore += score;
        moviePrestige[entry.movieId]!.appearances.push({
          criteriaId: entry.criteriaId!,
          criteriaName: entry.criteriaName,
          position,
          score,
        });
      }

      // Convert to array and sort by total score
      const prestigiousMovies = Object.values(moviePrestige)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, input.limit);

      // Sort appearances within each movie by score (highest first)
      prestigiousMovies.forEach(movie => {
        movie.appearances.sort((a, b) => b.score - a.score);
      });

      return prestigiousMovies;
    }),

  // Person overview: best movies, average, and role breakdown
  getPersonOverview: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      maxPerRole: z.number().int().min(1).max(100).optional().default(12),
      actorCriteriaId: z.string().optional().nullable(),
    }))
    .query(async ({ input }) => {
      const personName = input.name.trim();
      if (!personName) return null;

      // Load required data (reuse same sets as other aggregations)
      const [allCriteria, allMovies, evaluations, scores] = await Promise.all([
        db.select().from(criteria),
        db.select().from(movie),
        db.select().from(evaluation),
        db.select().from(evaluationScore),
      ]);

      const mainCriteria = allCriteria.filter((c) => !c.parentId);
      const subCriteria = allCriteria.filter((c) => c.parentId);

      const evalScores: Record<string, { criteriaId: string; score: number }[]> = {};
      for (const s of scores) {
        if (s.evaluationId && s.criteriaId != null && s.score != null) {
          const arr = (evalScores[s.evaluationId] ||= []);
          arr.push({ criteriaId: s.criteriaId, score: Number(s.score) });
        }
      }

      const movieEvaluations: Record<string, string[]> = {};
      for (const ev of evaluations) {
        if (ev.movieId && ev.id) {
          const arr = (movieEvaluations[ev.movieId] ||= []);
          arr.push(ev.id);
        }
      }

      const movieScores: Record<string, number> = {};
      for (const mv of allMovies) {
        const evalIds = movieEvaluations[mv.id ?? ""] || [];
        let weightedSum = 0;
        let totalWeight = 0;
        for (const main of mainCriteria) {
          const subs = subCriteria.filter((sc) => sc.parentId === main.id);
          let subWeightedSum = 0;
          let subTotalWeight = 0;
          for (const sub of subs) {
            const subScores: number[] = [];
            for (const evalId of evalIds) {
              const scoresForEval = evalScores[evalId] || [];
              const found = scoresForEval.find((s) => s.criteriaId === sub.id);
              if (found) subScores.push(found.score);
            }
            if (subScores.length > 0 && (sub.weight ?? 0) > 0) {
              const avg = subScores.reduce((a, b) => a + b, 0) / subScores.length;
              subWeightedSum += avg * (sub.weight ?? 0);
              subTotalWeight += sub.weight ?? 0;
            }
          }
          if (subTotalWeight > 0 && (main.weight ?? 0) > 0) {
            const mainValue = subWeightedSum / subTotalWeight;
            weightedSum += mainValue * (main.weight ?? 0);
            totalWeight += main.weight ?? 0;
          }
        }
        if (totalWeight > 0) movieScores[mv.id ?? ""] = weightedSum / totalWeight;
      }

      const actorSubScoreByMovie: Record<string, number | undefined> = {};
      if (input.actorCriteriaId) {
        const targetId = input.actorCriteriaId;
        for (const mv of allMovies) {
          const evalIds = movieEvaluations[mv.id ?? ""] || [];
          const vals: number[] = [];
          for (const eid of evalIds) {
            const sarr = evalScores[eid] || [];
            const f = sarr.find((s) => s.criteriaId === targetId);
            if (f) vals.push(f.score);
          }
          if (vals.length > 0) actorSubScoreByMovie[mv.id ?? ""] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }

      const splitCsv = (s?: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      const eqName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

      const roles: Array<"actor" | "writer" | "director"> = ["actor", "writer", "director"];
      type MovieInfo = { id: string; title: string | null; year: number | null; posterUrl: string | null; score?: number; actorScore?: number };
      const byRole: Record<string, MovieInfo[]> = { actor: [], writer: [], director: [] };
      const seenMovies = new Set<string>();

      for (const mv of allMovies) {
        const mvId = mv.id ?? "";
        if (!mvId) continue;
        const overall = movieScores[mvId];
        const perRoleNames: Record<string, string[]> = {
          actor: splitCsv(mv.actors),
          writer: splitCsv(mv.writer),
          director: splitCsv(mv.director),
        };
        for (const role of roles) {
          const names = perRoleNames[role];
          if (names.some((n) => eqName(n, personName))) {
            const info: MovieInfo = { id: mvId, title: mv.title ?? null, year: mv.year ?? null, posterUrl: mv.posterUrl ?? null, score: overall };
            if (role === "actor" && input.actorCriteriaId) info.actorScore = actorSubScoreByMovie[mvId];
            byRole[role].push(info);
            seenMovies.add(mvId);
          }
        }
      }

      // Sort by overall score desc (fallback by title)
      const sorter = (a: MovieInfo, b: MovieInfo) => {
        const sa = a.score ?? 0;
        const sb = b.score ?? 0;
        if (sa !== sb) return sb - sa;
        return (a.title ?? "").localeCompare(b.title ?? "");
      };
      for (const r of roles) byRole[r].sort(sorter);

      const allInvolved = Array.from(seenMovies);
      const avg = allInvolved.length > 0
        ? allInvolved.map((id) => movieScores[id] ?? 0).reduce((a, b) => a + b, 0) / allInvolved.length
        : 0;

      return {
        name: personName,
        average: avg,
        counts: { actor: byRole.actor.length, writer: byRole.writer.length, director: byRole.director.length },
        actor: byRole.actor.slice(0, input.maxPerRole ?? 12),
        writer: byRole.writer.slice(0, input.maxPerRole ?? 12),
        director: byRole.director.slice(0, input.maxPerRole ?? 12),
      };
    }),

  // List all movies for a person by role (for filtering/sorting/charts on People Page)
  getPersonMovies: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      role: z.enum(["actor", "writer", "director"]),
      actorCriteriaId: z.string().optional().nullable(),
    }))
    .query(async ({ input }) => {
      const personName = input.name.trim();
      if (!personName) return [] as Array<{
        id: string; title: string | null; year: number | null; posterUrl: string | null; score?: number; actorScore?: number;
      }>;

      const [allCriteria, allMovies, evaluations, scores] = await Promise.all([
        db.select().from(criteria),
        db.select().from(movie),
        db.select().from(evaluation),
        db.select().from(evaluationScore),
      ]);

      const mainCriteria = allCriteria.filter((c) => !c.parentId);
      const subCriteria = allCriteria.filter((c) => c.parentId);

      const evalScores: Record<string, { criteriaId: string; score: number }[]> = {};
      for (const s of scores) {
        if (s.evaluationId && s.criteriaId != null && s.score != null) {
          const arr = (evalScores[s.evaluationId] ||= []);
          arr.push({ criteriaId: s.criteriaId, score: Number(s.score) });
        }
      }

      const movieEvaluations: Record<string, string[]> = {};
      for (const ev of evaluations) {
        if (ev.movieId && ev.id) {
          const arr = (movieEvaluations[ev.movieId] ||= []);
          arr.push(ev.id);
        }
      }

      const movieScores: Record<string, number> = {};
      for (const mv of allMovies) {
        const evalIds = movieEvaluations[mv.id ?? ""] || [];
        let weightedSum = 0;
        let totalWeight = 0;
        for (const main of mainCriteria) {
          const subs = subCriteria.filter((sc) => sc.parentId === main.id);
          let subWeightedSum = 0;
          let subTotalWeight = 0;
          for (const sub of subs) {
            const subScores: number[] = [];
            for (const evalId of evalIds) {
              const scoresForEval = evalScores[evalId] || [];
              const found = scoresForEval.find((s) => s.criteriaId === sub.id);
              if (found) subScores.push(found.score);
            }
            if (subScores.length > 0 && (sub.weight ?? 0) > 0) {
              const avg = subScores.reduce((a, b) => a + b, 0) / subScores.length;
              subWeightedSum += avg * (sub.weight ?? 0);
              subTotalWeight += sub.weight ?? 0;
            }
          }
          if (subTotalWeight > 0 && (main.weight ?? 0) > 0) {
            const mainValue = subWeightedSum / subTotalWeight;
            weightedSum += mainValue * (main.weight ?? 0);
            totalWeight += main.weight ?? 0;
          }
        }
        if (totalWeight > 0) movieScores[mv.id ?? ""] = weightedSum / totalWeight;
      }

      const actorSubScoreByMovie: Record<string, number | undefined> = {};
      if (input.role === "actor" && input.actorCriteriaId) {
        const targetId = input.actorCriteriaId;
        for (const mv of allMovies) {
          const evalIds = movieEvaluations[mv.id ?? ""] || [];
          const vals: number[] = [];
          for (const eid of evalIds) {
            const sarr = evalScores[eid] || [];
            const f = sarr.find((s) => s.criteriaId === targetId);
            if (f) vals.push(f.score);
          }
          if (vals.length > 0) actorSubScoreByMovie[mv.id ?? ""] = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }

      const splitCsv = (s?: string | null) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      const eqName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

      const res: Array<{ id: string; title: string | null; year: number | null; posterUrl: string | null; score?: number; actorScore?: number }>= [];
      for (const mv of allMovies) {
        const mvId = mv.id ?? "";
        if (!mvId) continue;
        let names: string[] = [];
        if (input.role === "actor") names = splitCsv(mv.actors);
        else if (input.role === "writer") names = splitCsv(mv.writer);
        else if (input.role === "director") names = splitCsv(mv.director);
        if (names.some((n) => eqName(n, personName))) {
          res.push({
            id: mvId,
            title: mv.title ?? null,
            year: mv.year ?? null,
            posterUrl: mv.posterUrl ?? null,
            score: movieScores[mvId],
            actorScore: input.role === "actor" ? actorSubScoreByMovie[mvId] : undefined,
          });
        }
      }

      return res;
    }),

  // Fetch person info (bio + thumbnail) from Wikipedia REST API
  getPersonInfo: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(async ({ input }) => {
      const title = encodeURIComponent(input.name.trim());
      if (!title) return null as null | {
        title: string; description?: string; extract?: string; thumbnailUrl?: string; wikipediaUrl?: string;
      };
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
      try {
        const res = await fetch(url, { headers: { 'accept': 'application/json' } });
        if (!res.ok) return null;
        const json: any = await res.json();
        // If it's a disambiguation page, bail
        if (json?.type === 'disambiguation') return null;
        return {
          title: json?.title ?? input.name,
          description: json?.description ?? undefined,
          extract: json?.extract ?? undefined,
          thumbnailUrl: json?.thumbnail?.source ?? undefined,
          wikipediaUrl: json?.content_urls?.desktop?.page ?? (json?.titles?.canonical ? `https://en.wikipedia.org/wiki/${json.titles.canonical}` : undefined),
        };
      } catch {
        return null;
      }
    }),
});
