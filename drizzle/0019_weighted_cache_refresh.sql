-- Incremental weighted score cache: compute function + triggers
-- Depends on tables: cinecritique_movie, cinecritique_evaluation, cinecritique_evaluation_score,
-- cinecritique_criteria, cinecritique_movie_criteria_override (optional overrides)

-- Computes and upserts weighted score for a single movie
CREATE OR REPLACE FUNCTION refresh_movie_weighted_cache(p_movie_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_score numeric(3,1);
  v_breakdown jsonb;
BEGIN
  /*
    Replace inner SELECTs if your actual weighting logic differs.
    Assumptions:
      - cinecritique_evaluation: rows referencing movie_id
      - cinecritique_evaluation_score: numeric value per criteria, references evaluation_id
      - cinecritique_criteria: holds default weight per criteria
      - cinecritique_movie_criteria_override: optional per-movie overrides (exclude/include via mode)
  */
  WITH per_criteria AS (
    SELECT
      es.evaluation_id,
      es.criteria_id,
      es.score::numeric AS value,
      COALESCE(c.weight, 1)::numeric AS weight
    FROM cinecritique_evaluation_score es
    JOIN cinecritique_evaluation e ON e.id = es.evaluation_id
    JOIN cinecritique_criteria c ON c.id = es.criteria_id
    LEFT JOIN cinecritique_movie_criteria_override ov
      ON ov.movie_id = e.movie_id AND ov.criteria_id = es.criteria_id
    WHERE e.movie_id = p_movie_id
      AND COALESCE(ov.mode <> 'exclude', true)
  ),
  per_eval AS (
    SELECT
      evaluation_id,
      SUM(value * weight) / NULLIF(SUM(weight), 0) AS weighted_eval_score
    FROM per_criteria
    GROUP BY evaluation_id
  ),
  agg AS (
    SELECT
      ROUND(AVG(weighted_eval_score)::numeric, 1) AS movie_weighted_score,
      JSONB_BUILD_OBJECT(
        'eval_count', COUNT(*),
        'avg', ROUND(AVG(weighted_eval_score)::numeric, 2),
        'min', ROUND(MIN(weighted_eval_score)::numeric, 2),
        'max', ROUND(MAX(weighted_eval_score)::numeric, 2)
      ) AS breakdown
    FROM per_eval
  )
  SELECT movie_weighted_score, breakdown
  INTO v_score, v_breakdown
  FROM agg;

  -- Default when no evaluations exist
  v_score := COALESCE(v_score, 0.0);
  v_breakdown := COALESCE(v_breakdown, JSONB_BUILD_OBJECT('eval_count', 0));

  INSERT INTO cinecritique_movie_weighted_cache (movie_id, score, breakdown_json)
  VALUES (p_movie_id, v_score, v_breakdown::text)
  ON CONFLICT (movie_id)
  DO UPDATE SET score = EXCLUDED.score, breakdown_json = EXCLUDED.breakdown_json;
END;
$$;

-- Trigger helper: evaluation table (movie_id directly present)
CREATE OR REPLACE FUNCTION trg_refresh_cache_from_evaluation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_movie_weighted_cache(COALESCE(NEW.movie_id, OLD.movie_id));
  RETURN NULL;
END;
$$;

-- Trigger helper: evaluation_score table (lookup movie via evaluation)
CREATE OR REPLACE FUNCTION trg_refresh_cache_from_score()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_movie_id text;
BEGIN
  SELECT e.movie_id INTO v_movie_id FROM cinecritique_evaluation e
  WHERE e.id = COALESCE(NEW.evaluation_id, OLD.evaluation_id);
  IF v_movie_id IS NOT NULL THEN
    PERFORM refresh_movie_weighted_cache(v_movie_id);
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger helper: per-movie criteria overrides
CREATE OR REPLACE FUNCTION trg_refresh_cache_from_override()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_movie_weighted_cache(COALESCE(NEW.movie_id, OLD.movie_id));
  RETURN NULL;
END;
$$;

-- Triggers
DO $$
BEGIN
  IF to_regclass('public.cinecritique_evaluation') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS t_evaluation_refresh ON cinecritique_evaluation;
    CREATE TRIGGER t_evaluation_refresh
    AFTER INSERT OR UPDATE OR DELETE ON cinecritique_evaluation
    FOR EACH ROW EXECUTE FUNCTION trg_refresh_cache_from_evaluation();
  END IF;

  IF to_regclass('public.cinecritique_evaluation_score') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS t_evaluation_score_refresh ON cinecritique_evaluation_score;
    CREATE TRIGGER t_evaluation_score_refresh
    AFTER INSERT OR UPDATE OR DELETE ON cinecritique_evaluation_score
    FOR EACH ROW EXECUTE FUNCTION trg_refresh_cache_from_score();
  END IF;

  IF to_regclass('public.cinecritique_movie_criteria_override') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS t_override_refresh ON cinecritique_movie_criteria_override;
    CREATE TRIGGER t_override_refresh
    AFTER INSERT OR UPDATE OR DELETE ON cinecritique_movie_criteria_override
    FOR EACH ROW EXECUTE FUNCTION trg_refresh_cache_from_override();
  END IF;
END $$;

-- Optional full rebuild function (useful after global weight changes)
CREATE OR REPLACE FUNCTION rebuild_all_movie_weighted_cache()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM cinecritique_movie
  LOOP
    PERFORM refresh_movie_weighted_cache(r.id);
  END LOOP;
END;
$$;
