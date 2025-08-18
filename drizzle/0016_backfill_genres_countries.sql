-- ===== Uniqueness on junctions =====
CREATE UNIQUE INDEX IF NOT EXISTS cinecritique_movie_genre_unique
  ON cinecritique_movie_genre (movie_id, genre_id);

CREATE UNIQUE INDEX IF NOT EXISTS cinecritique_movie_country_unique
  ON cinecritique_movie_country (movie_id, country_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS cinecritique_genre_slug ON cinecritique_genre (slug);
CREATE INDEX IF NOT EXISTS cinecritique_country_slug ON cinecritique_country (slug);
CREATE INDEX IF NOT EXISTS cinecritique_movie_genre_movie ON cinecritique_movie_genre (movie_id);
CREATE INDEX IF NOT EXISTS cinecritique_movie_genre_genre ON cinecritique_movie_genre (genre_id);
CREATE INDEX IF NOT EXISTS cinecritique_movie_country_movie ON cinecritique_movie_country (movie_id);
CREATE INDEX IF NOT EXISTS cinecritique_movie_country_country ON cinecritique_movie_country (country_id);

-- ===== Backfill reference tables from CSVs =====
WITH genres AS (
  SELECT DISTINCT trim(g) AS name
  FROM cinecritique_movie m,
  LATERAL regexp_split_to_table(COALESCE(m.genre, ''), '\\s*,\\s*') g
  WHERE COALESCE(m.genre, '') <> ''
),
to_insert AS (
  SELECT name,
         lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g')) AS slug
  FROM genres
)
INSERT INTO cinecritique_genre (name, slug)
SELECT ti.name, ti.slug
FROM to_insert ti
LEFT JOIN cinecritique_genre cg ON cg.slug = ti.slug
WHERE cg.id IS NULL;

WITH countries AS (
  SELECT DISTINCT trim(c) AS name
  FROM cinecritique_movie m,
  LATERAL regexp_split_to_table(COALESCE(m.country, ''), '\\s*,\\s*') c
  WHERE COALESCE(m.country, '') <> ''
),
to_insert AS (
  SELECT name,
         lower(regexp_replace(name, '[^a-z0-9]+', '-', 'g')) AS slug
  FROM countries
)
INSERT INTO cinecritique_country (name, slug)
SELECT ti.name, ti.slug
FROM to_insert ti
LEFT JOIN cinecritique_country cc ON cc.slug = ti.slug
WHERE cc.id IS NULL;

-- ===== Backfill junctions =====
WITH mg AS (
  SELECT m.id AS movie_id, cg.id AS genre_id,
         row_number() OVER (PARTITION BY m.id ORDER BY ordinality) - 1 AS position
  FROM cinecritique_movie m,
       LATERAL regexp_split_to_table(COALESCE(m.genre, ''), '\\s*,\\s*') WITH ORDINALITY g(name, ordinality)
  JOIN cinecritique_genre cg
    ON cg.slug = lower(regexp_replace(trim(g.name), '[^a-z0-9]+', '-', 'g'))
  WHERE COALESCE(m.genre, '') <> ''
)
INSERT INTO cinecritique_movie_genre (movie_id, genre_id, position)
SELECT movie_id, genre_id, position
FROM mg
ON CONFLICT DO NOTHING;

WITH mc AS (
  SELECT m.id AS movie_id, cc.id AS country_id
  FROM cinecritique_movie m,
       LATERAL regexp_split_to_table(COALESCE(m.country, ''), '\\s*,\\s*') c(name)
  JOIN cinecritique_country cc
    ON cc.slug = lower(regexp_replace(trim(c.name), '[^a-z0-9]+', '-', 'g'))
  WHERE COALESCE(m.country, '') <> ''
)
INSERT INTO cinecritique_movie_country (movie_id, country_id)
SELECT movie_id, country_id
FROM mc
ON CONFLICT DO NOTHING;