DROP TABLE "cinecritique_omdb_movie" CASCADE;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "imdb_id" text PRIMARY KEY NOT NULL;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "rated" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "released" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "runtime" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "director" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "writer" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "actors" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "plot" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "awards" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "dvd" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "box_office" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "production" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "response" text;