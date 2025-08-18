-- Optional performance optimizations for ILIKE searches
-- Requires Postgres pg_trgm extension

-- 1) Ensure pg_trgm is available (no-op if already installed)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Trigram indexes for leading-wildcard ILIKE filters used on the home page
--    e.g. WHERE g.name ILIKE '%<genre>%'
CREATE INDEX IF NOT EXISTS cinecritique_genre_name_trgm
  ON cinecritique_genre USING gin (name gin_trgm_ops);

--    e.g. WHERE movie.title ILIKE '%<search>%'
CREATE INDEX IF NOT EXISTS cinecritique_movie_title_trgm
  ON cinecritique_movie USING gin (title gin_trgm_ops);

--    e.g. WHERE movie.director ILIKE '%<director>%'
CREATE INDEX IF NOT EXISTS cinecritique_movie_director_trgm
  ON cinecritique_movie USING gin (director gin_trgm_ops);

--    e.g. WHERE movie.actors ILIKE '%<actor>%'
CREATE INDEX IF NOT EXISTS cinecritique_movie_actors_trgm
  ON cinecritique_movie USING gin (actors gin_trgm_ops);

--    e.g. WHERE movie.writer ILIKE '%<writer>%'
CREATE INDEX IF NOT EXISTS cinecritique_movie_writer_trgm
  ON cinecritique_movie USING gin (writer gin_trgm_ops);
