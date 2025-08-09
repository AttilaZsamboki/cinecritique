
ALTER TABLE "cinecritique_criteria" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation_score" ALTER COLUMN "score" SET DATA TYPE numeric(2, 1);--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint