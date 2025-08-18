-- Indexes to speed up best_of queries

-- Enforce single best-of per (user, criteria)
CREATE UNIQUE INDEX IF NOT EXISTS cinecritique_best_of_unique_user_criteria
  ON cinecritique_best_of (user_id, criteria_id);

-- Fast lookups by user
CREATE INDEX IF NOT EXISTS cinecritique_best_of_user
  ON cinecritique_best_of (user_id);

-- Support frequent filtering and sorting
-- (ordering is done app-side today, but this index helps clustered retrieval)
CREATE INDEX IF NOT EXISTS cinecritique_best_of_user_criteria_order
  ON cinecritique_best_of (user_id, criteria_id, position ASC, created_at DESC);
