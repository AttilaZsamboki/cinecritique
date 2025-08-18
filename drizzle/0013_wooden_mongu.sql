CREATE TABLE "cinecritique_country" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"iso2" text,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "cinecritique_country_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cinecritique_genre" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "cinecritique_genre_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "cinecritique_movie_country" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" text NOT NULL,
	"country_id" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cinecritique_movie_genre" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"movie_id" text NOT NULL,
	"genre_id" text NOT NULL,
	"position" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cinecritique_movie_country" ADD CONSTRAINT "cinecritique_movie_country_movie_id_cinecritique_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinecritique_movie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_movie_country" ADD CONSTRAINT "cinecritique_movie_country_country_id_cinecritique_country_id_fk" FOREIGN KEY ("country_id") REFERENCES "public"."cinecritique_country"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_movie_genre" ADD CONSTRAINT "cinecritique_movie_genre_movie_id_cinecritique_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinecritique_movie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_movie_genre" ADD CONSTRAINT "cinecritique_movie_genre_genre_id_cinecritique_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."cinecritique_genre"("id") ON DELETE no action ON UPDATE no action;