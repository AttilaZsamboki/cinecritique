CREATE TABLE "cinecritique_criteria_default_applicability" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criteria_id" text,
	"default_mode" text,
	"include_types_csv" text,
	"exclude_types_csv" text,
	"include_genres_csv" text,
	"exclude_genres_csv" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cinecritique_movie_criteria_override" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" text,
	"criteria_id" text,
	"mode" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cinecritique_criteria_default_applicability" ADD CONSTRAINT "cinecritique_criteria_default_applicability_criteria_id_cinecritique_criteria_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."cinecritique_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_movie_criteria_override" ADD CONSTRAINT "cinecritique_movie_criteria_override_movie_id_cinecritique_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinecritique_movie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_movie_criteria_override" ADD CONSTRAINT "cinecritique_movie_criteria_override_criteria_id_cinecritique_criteria_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."cinecritique_criteria"("id") ON DELETE no action ON UPDATE no action;