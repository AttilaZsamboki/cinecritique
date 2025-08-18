import { criteria as criteriaTable, evaluation as evaluationTable, evaluationScore as evaluationScoreTable } from "~/server/db/schema";

export type CriteriaRow = typeof criteriaTable.$inferSelect;
export type EvaluationRow = typeof evaluationTable.$inferSelect;
export type EvaluationScoreRow = typeof evaluationScoreTable.$inferSelect;

export type WeightedBreakdown = Record<string, { name: string; value: number }[]>;
export type WeightedScores = Record<string, number>;

/**
 * Compute weighted average scores (0-5) per movie and optional top-3 main-criteria breakdown.
 * movies can be either a list of movie ids to include or undefined to include all encountered in evaluations.
 */
export function computeWeightedScores(
  params: {
    criteria: CriteriaRow[];
    evaluations: EvaluationRow[];
    scores: EvaluationScoreRow[];
    movieIds?: string[]; // limit computation to these ids
    includeBreakdown?: boolean;
  }
): { weighted: WeightedScores; breakdown: WeightedBreakdown } {
  const { criteria, evaluations, scores, movieIds, includeBreakdown = true } = params;

  const mainCriteria = criteria.filter((c) => !c.parentId);
  const subCriteria = criteria.filter((c) => c.parentId);

  // Map: movieId -> evaluation ids
  const movieEvaluations: Record<string, string[]> = {};
  for (const ev of evaluations) {
    if (!ev.movieId) continue;
    if (movieIds && !movieIds.includes(ev.movieId)) continue;
    (movieEvaluations[ev.movieId] ||= []).push(ev.id);
  }

  // Map: evaluation id -> scores array
  const evalScores: Record<string, { criteriaId: string; score: number }[]> = {};
  for (const s of scores) {
    if (!s.evaluationId) continue;
    (evalScores[s.evaluationId] ||= []).push({ criteriaId: s.criteriaId ?? "", score: Number(s.score) });
  }

  const weighted: WeightedScores = {};
  const breakdown: WeightedBreakdown = {};

  const movieIdList = movieIds ?? Object.keys(movieEvaluations);
  for (const mvId of movieIdList) {
    const evalIds = movieEvaluations[mvId] || [];

    let weightedSum = 0;
    let totalWeight = 0;
    const mainValues: { name: string; value: number }[] = [];

    for (const main of mainCriteria) {
      const subs = subCriteria.filter((sc) => sc.parentId === main.id);
      let subWeightedSum = 0;
      let subTotalWeight = 0;

      for (const sub of subs) {
        const subScores: number[] = [];
        for (const evId of evalIds) {
          const scoresForEval = evalScores[evId] || [];
          const found = scoresForEval.find((ss) => ss.criteriaId === sub.id);
          if (found) subScores.push(found.score);
        }
        if (subScores.length > 0 && sub.weight) {
          const avg = subScores.reduce((a, b) => a + b, 0) / subScores.length;
          subWeightedSum += avg * sub.weight;
          subTotalWeight += sub.weight;
        }
      }

      if (subTotalWeight > 0 && main.weight) {
        const mainValue = subWeightedSum / subTotalWeight;
        weightedSum += mainValue * main.weight;
        totalWeight += main.weight;
        if (includeBreakdown && main.name) {
          mainValues.push({ name: main.name, value: Math.round(mainValue * 10) / 10 });
        }
      }
    }

    if (totalWeight > 0) {
      weighted[mvId] = Math.round((weightedSum / totalWeight) * 100) / 100;
    }
    if (includeBreakdown) {
      breakdown[mvId] = mainValues.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 3);
    } else {
      breakdown[mvId] = [];
    }
  }

  return { weighted, breakdown };
}
