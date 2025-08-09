import { db } from "~/server/db";
import { bestOf, evaluation, evaluationScore } from "~/server/db/schema";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { sql } from "drizzle-orm";
import { criteria } from "~/server/db/schema";
import { movie } from "~/server/db/schema";

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
      const siblingCount = await db.query.criteria.findMany({ where: (c, { eq }) => eq(c.parentId, input.parentId ?? null) });
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
    })
});
