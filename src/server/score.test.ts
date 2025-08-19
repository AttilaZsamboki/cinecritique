import { describe, it, expect } from 'vitest';
import { computeWeightedScores, type CriteriaRow, type EvaluationRow, type EvaluationScoreRow } from './score';

function c(id: string, name: string, weight: number, parentId: string | null = null): CriteriaRow {
  return { id, name, weight, parentId } as unknown as CriteriaRow;
}
function ev(id: string, movieId: string): EvaluationRow {
  return { id, movieId } as unknown as EvaluationRow;
}
function es(evaluationId: string, criteriaId: string, score: number): EvaluationScoreRow {
  return { id: `${evaluationId}:${criteriaId}` as any, evaluationId, criteriaId, score: score as any } as unknown as EvaluationScoreRow;
}

describe('computeWeightedScores', () => {
  it('computes overall weighted scores and a top-3 breakdown', () => {
    const mainA = c('A', 'Story', 2, null);
    const mainB = c('B', 'Craft', 1, null);
    const subA1 = c('A1', 'Plot', 1, 'A');
    const subA2 = c('A2', 'Characters', 1, 'A');
    const subB1 = c('B1', 'Cinematography', 1, 'B');

    const criteria = [mainA, mainB, subA1, subA2, subB1];

    const evaluations = [ev('e1', 'm1'), ev('e2', 'm1')];

    const scores = [
      es('e1', 'A1', 4.5), es('e1', 'A2', 4.0), es('e1', 'B1', 3.5),
      es('e2', 'A1', 5.0), es('e2', 'A2', 4.5), es('e2', 'B1', 4.0),
    ];

    const { weighted, breakdown } = computeWeightedScores({ criteria, evaluations, scores });

    expect(weighted['m1']).toBeDefined();
    // A avg = ((4.5+5)/2 + (4+4.5)/2)/2 = (4.75 + 4.25)/2 = 4.5 → weighted with mainA(2) and mainB(1)
    // B avg = ((3.5+4)/2) = 3.75
    // overall = (4.5*2 + 3.75*1) / (2+1) = (9 + 3.75)/3 = 4.25
    expect(weighted['m1']).toBeCloseTo(4.25, 2);

    expect(breakdown['m1']).toBeDefined();
    const bd = breakdown['m1']!;
    expect(bd.length).toBeGreaterThan(0);
    expect(bd[0]!.name).toBe('Story');
  });

  it('respects movieIds filter and includeBreakdown flag', () => {
    const main = c('M', 'Main', 1, null);
    const sub = c('S', 'Sub', 1, 'M');
    const criteria = [main, sub];
    const evaluations = [ev('e1', 'm1'), ev('e2', 'm2')];
    const scores = [es('e1', 'S', 4), es('e2', 'S', 2)];

    const { weighted, breakdown } = computeWeightedScores({ criteria, evaluations, scores, movieIds: ['m2'], includeBreakdown: false });
    expect(Object.keys(weighted)).toEqual(['m2']);
    expect(breakdown['m2']).toEqual([]);
  });
});
