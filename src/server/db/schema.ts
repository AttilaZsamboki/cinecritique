// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import { pgTableCreator } from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `cinecritique_${name}`);

// Auth.js (NextAuth) core tables with a custom Users table that includes a role column
// Based on @auth/drizzle-adapter Postgres schema
export const users = createTable("users", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: d.text("name"),
  email: d.text("email").unique(),
  emailVerified: d.timestamp("email_verified"),
  image: d.text("image"),
  role: d.text("role").default(sql`'user'`), // 'user' | 'admin'
}));

export const accounts = createTable("accounts", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: d.text("user_id").notNull().references(() => users.id),
  type: d.text("type").notNull(),
  provider: d.text("provider").notNull(),
  providerAccountId: d.text("provider_account_id").notNull(),
  refresh_token: d.text("refresh_token"),
  access_token: d.text("access_token"),
  expires_at: d.integer("expires_at"),
  token_type: d.text("token_type"),
  scope: d.text("scope"),
  id_token: d.text("id_token"),
  session_state: d.text("session_state"),
}));

export const sessions = createTable("sessions", (d) => ({
  sessionToken: d.text("session_token").primaryKey(),
  userId: d.text("user_id").notNull().references(() => users.id),
  expires: d.timestamp("expires").notNull(),
}));

export const verificationTokens = createTable("verification_token", (d) => ({
  identifier: d.text("identifier").notNull(),
  token: d.text("token").notNull().unique(),
  expires: d.timestamp("expires").notNull(),
}));

export const criteria = createTable(
  "criteria",
  (d) => ({
    id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
    name: d.text("name"),
    description: d.text("description"),
    weight: d.integer("weight"),
    position: d.integer("position"),
    parentId: d.text("parent_id"), // nullable, self-referencing (no .references() to avoid linter error)
  })
);

export const movie = createTable("movie", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: d.text("title").unique(),
  type: d.text("type"),
  year: d.integer("year"),
  genre: d.text("genre"), // new genre column
  posterUrl: d.text("poster_url"),
  imdbID: d.text("imdb_id"),
  rated: d.text("rated"),
  released: d.text("released"),
  runtime: d.text("runtime"),
  director: d.text("director"),
  writer: d.text("writer"),
  actors: d.text("actors"),
  plot: d.text("plot"),
  language: d.text("language"),
  country: d.text("country"),
  awards: d.text("awards"),
  dvd: d.text("dvd"),
  boxOffice: d.text("box_office"),
  production: d.text("production"),
  website: d.text("website"),
  response: d.text("response"),
}));

export const evaluation = createTable("evaluation", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  movieId: d.text("movie_id").references(() => movie.id),
  userId: d.text("user_id").references(() => users.id),
  date: d.timestamp("date"),
}));

export const evaluationScore = createTable("evaluation_score", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  evaluationId: d.text("evaluation_id").references(() => evaluation.id),
  criteriaId: d.text("criteria_id").references(() => criteria.id),
  score: d.numeric("score", { precision: 2, scale: 1 }), // 0-5, 0.5 increments
}));

// Stores the user's current "best in category" pick per sub-criteria
export const bestOf = createTable("best_of", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  criteriaId: d.text("criteria_id").references(() => criteria.id),
  movieId: d.text("movie_id").references(() => movie.id),
  clipUrl: d.text("clip_url"),
  position: d.integer("position"),
  createdAt: d.timestamp("created_at").default(sql`now()`),
  userId: d.text("user_id").references(() => users.id), // per-user picks
}));

// Per-movie override to include or exclude a criterion
export const movieCriteriaOverride = createTable("movie_criteria_override", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  movieId: d.text("movie_id").references(() => movie.id),
  criteriaId: d.text("criteria_id").references(() => criteria.id),
  mode: d.text("mode"), // 'include' | 'exclude'
  createdAt: d.timestamp("created_at").default(sql`now()`),
  userId: d.text("user_id").references(() => users.id), // per-user overrides
}));

// Default applicability rules per criterion. CSV fields kept simple for now.
export const criteriaDefaultApplicability = createTable("criteria_default_applicability", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  criteriaId: d.text("criteria_id").references(() => criteria.id),
  defaultMode: d.text("default_mode"), // 'include' | 'exclude' (fallback if no filters match); default is 'include' when null
  includeTypesCsv: d.text("include_types_csv"), // e.g. "animation,documentary"
  excludeTypesCsv: d.text("exclude_types_csv"),
  includeGenresCsv: d.text("include_genres_csv"),
  excludeGenresCsv: d.text("exclude_genres_csv"),
  createdAt: d.timestamp("created_at").default(sql`now()`),
}));

// Named scoring presets (weights) that can be saved/loaded and applied globally
export const criteriaPreset = createTable("criteria_preset", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: d.text("name").notNull(),
  description: d.text("description"),
  createdAt: d.timestamp("created_at").default(sql`now()`),
  createdBy: d.text("created_by").references(() => users.id),
  isGlobal: d.boolean("is_global").default(sql`false`), // only admins can set true
}));

export const criteriaPresetWeight = createTable("criteria_preset_weight", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  presetId: d.text("preset_id").references(() => criteriaPreset.id),
  criteriaId: d.text("criteria_id").references(() => criteria.id),
  weight: d.integer("weight").notNull(),
  createdAt: d.timestamp("created_at").default(sql`now()`),
}));

// Cache for per-movie weighted scores (materialized by a background job or admin endpoint)
export const movieWeightedCache = createTable("movie_weighted_cache", (d) => ({
  movieId: d.text("movie_id").primaryKey().references(() => movie.id),
  score: d.numeric("score", { precision: 3, scale: 1 }).notNull(),
  breakdownJson: d.text("breakdown_json"),
}));

// Normalized reference tables and junctions (preserve legacy CSV columns on `movie` during transition)
export const genre = createTable("genre", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: d.text("name").notNull(),
  slug: d.text("slug").notNull().unique(),
  createdAt: d.timestamp("created_at").default(sql`now()`),
}));

export const country = createTable("country", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: d.text("name").notNull(),
  iso2: d.text("iso2"), // optional ISO alpha-2 code
  slug: d.text("slug").notNull().unique(),
  createdAt: d.timestamp("created_at").default(sql`now()`),
}));

export const movieGenre = createTable("movie_genre", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  movieId: d.text("movie_id").notNull().references(() => movie.id),
  genreId: d.text("genre_id").notNull().references(() => genre.id),
  position: d.integer("position"), // order from source if available
  createdAt: d.timestamp("created_at").default(sql`now()`),
}));

export const movieCountry = createTable("movie_country", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  movieId: d.text("movie_id").notNull().references(() => movie.id),
  countryId: d.text("country_id").notNull().references(() => country.id),
  createdAt: d.timestamp("created_at").default(sql`now()`),
}));
