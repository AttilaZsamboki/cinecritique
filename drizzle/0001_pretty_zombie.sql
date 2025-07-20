ALTER TABLE "cinecritique_evalutation" RENAME TO "cinecritique_evaluation";--> statement-breakpoint
ALTER TABLE "cinecritique_evalutation_score" RENAME TO "cinecritique_evaluation_score";--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" RENAME COLUMN "evalutation_id" TO "evaluation_id";--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation" DROP CONSTRAINT "cinecritique_evalutation_movie_id_cinecritique_movie_id_fk";
--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" DROP CONSTRAINT "cinecritique_evalutation_score_evalutation_id_cinecritique_evalutation_id_fk";
--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" DROP CONSTRAINT "cinecritique_evalutation_score_criteria_id_cinecritique_criteria_id_fk";
--> statement-breakpoint
ALTER TABLE "cinecritique_criteria" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" ALTER COLUMN "score" SET DATA TYPE numeric(2, 1);--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cinecritique_criteria" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation" ADD CONSTRAINT "cinecritique_evaluation_movie_id_cinecritique_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinecritique_movie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" ADD CONSTRAINT "cinecritique_evaluation_score_evaluation_id_cinecritique_evaluation_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."cinecritique_evaluation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" ADD CONSTRAINT "cinecritique_evaluation_score_criteria_id_cinecritique_criteria_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."cinecritique_criteria"("id") ON DELETE no action ON UPDATE no action;