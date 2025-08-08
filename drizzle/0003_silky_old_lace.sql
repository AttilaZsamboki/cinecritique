CREATE TABLE "cinecritique_best_of" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criteria_id" text,
	"movie_id" text,
	"clip_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD COLUMN "poster_url" text;--> statement-breakpoint
ALTER TABLE "cinecritique_best_of" ADD CONSTRAINT "cinecritique_best_of_criteria_id_cinecritique_criteria_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."cinecritique_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_best_of" ADD CONSTRAINT "cinecritique_best_of_movie_id_cinecritique_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinecritique_movie"("id") ON DELETE no action ON UPDATE no action;