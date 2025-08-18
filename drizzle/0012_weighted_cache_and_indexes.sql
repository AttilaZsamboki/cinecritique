-- Create indexes to speed up common queries
CREATE INDEX IF NOT EXISTS idx_movie_title ON cinecritique_movie (title);
CREATE INDEX IF NOT EXISTS idx_movie_year ON cinecritique_movie (year);
CREATE INDEX IF NOT EXISTS idx_movie_genre ON cinecritique_movie (genre);
CREATE INDEX IF NOT EXISTS idx_evaluation_movie_id ON cinecritique_evaluation (movie_id);
CREATE INDEX IF NOT EXISTS idx_eval_score_eval_id ON cinecritique_evaluation_score (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_eval_score_criteria_id ON cinecritique_evaluation_score (criteria_id);
CREATE INDEX IF NOT EXISTS idx_criteria_parent ON cinecritique_criteria (parent_id);

-- Materialized cache table for weighted scores
CREATE TABLE IF NOT EXISTS cinecritique_movie_weighted_cache (
  movie_id text PRIMARY KEY REFERENCES cinecritique_movie(id),
  score numeric(3,1) NOT NULL,
  breakdown_json text
);

-- Helpful index for ordering by score
CREATE INDEX IF NOT EXISTS idx_movie_weighted_score ON cinecritique_movie_weighted_cache (score DESC);
