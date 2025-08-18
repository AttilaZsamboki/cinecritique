CREATE TABLE "cinecritique_criteria_preset" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cinecritique_criteria_preset_weight" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"preset_id" text,
	"criteria_id" text,
	"weight" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ALTER COLUMN "box_office" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "cinecritique_criteria_preset_weight" ADD CONSTRAINT "cinecritique_criteria_preset_weight_preset_id_cinecritique_criteria_preset_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."cinecritique_criteria_preset"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_criteria_preset_weight" ADD CONSTRAINT "cinecritique_criteria_preset_weight_criteria_id_cinecritique_criteria_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."cinecritique_criteria"("id") ON DELETE no action ON UPDATE no action;