import { db } from "~/server/db";
import { evaluation, evaluationScore } from "~/server/db/schema";
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
  updateCriteriaWeight: publicProcedure
    .input(z.object({ id: z.string(), weight: z.number().min(0).max(100) }))
    .mutation(async ({ input }) => {
      await db.update(criteria)
        .set({ weight: input.weight })
        .where(sql`id = ${input.id}`);
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
    .input(z.object({ title: z.string().optional().nullable(), year: z.number().optional().nullable(), genre: z.string().optional().nullable(), type: z.string().optional().nullable()}))
    .mutation(async ({ input }) => {
      return db.insert(movie).values(input).returning()
    }
    )
});
