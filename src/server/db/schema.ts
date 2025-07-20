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

export const criteria = createTable(
  "criteria",
  (d) => ({
    id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
    name: d.text("name"),
    description: d.text("description"),
    weight: d.integer("weight"),
    parentId: d.text("parent_id"), // nullable, self-referencing (no .references() to avoid linter error)
  })
);

export const movie = createTable("movie", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  title: d.text("title"),
  type: d.text("type"),
  year: d.integer("year"),
  genre: d.text("genre"), // new genre column
}));

export const evaluation = createTable("evaluation", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  movieId: d.text("movie_id").references(() => movie.id),
  date: d.timestamp("date"),
}));

export const evaluationScore = createTable("evaluation_score", (d) => ({
  id: d.text("id").primaryKey().default(sql`gen_random_uuid()`),
  evaluationId: d.text("evaluation_id").references(() => evaluation.id),
  criteriaId: d.text("criteria_id").references(() => criteria.id),
  score: d.numeric("score", { precision: 2, scale: 1 }), // 0-5, 0.5 increments
}));
