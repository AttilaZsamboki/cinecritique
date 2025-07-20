CREATE TABLE "cinecritique_criteria" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"description" text,
	"weight" integer
);
--> statement-breakpoint
CREATE TABLE "cinecritique_evalutation" (
	"id" text PRIMARY KEY NOT NULL,
	"movie_id" text,
	"date" timestamp
);
--> statement-breakpoint
CREATE TABLE "cinecritique_evalutation_score" (
	"id" text PRIMARY KEY NOT NULL,
	"evalutation_id" text,
	"criteria_id" text,
	"score" integer
);
--> statement-breakpoint
CREATE TABLE "cinecritique_movie" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text,
	"type" text,
	"year" integer
);
--> statement-breakpoint
ALTER TABLE "cinecritique_evalutation" ADD CONSTRAINT "cinecritique_evalutation_movie_id_cinecritique_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinecritique_movie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_evalutation_score" ADD CONSTRAINT "cinecritique_evalutation_score_evalutation_id_cinecritique_evalutation_id_fk" FOREIGN KEY ("evalutation_id") REFERENCES "public"."cinecritique_evalutation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_evalutation_score" ADD CONSTRAINT "cinecritique_evalutation_score_criteria_id_cinecritique_criteria_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."cinecritique_criteria"("id") ON DELETE no action ON UPDATE no action;