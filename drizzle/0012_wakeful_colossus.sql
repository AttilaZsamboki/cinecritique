CREATE TABLE "cinecritique_accounts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "cinecritique_movie_weighted_cache" (
	"movie_id" text PRIMARY KEY NOT NULL,
	"score" numeric(3, 1) NOT NULL,
	"breakdown_json" text
);
--> statement-breakpoint
CREATE TABLE "cinecritique_sessions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "cinecritique_sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "cinecritique_users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"role" text DEFAULT 'user',
	CONSTRAINT "cinecritique_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "cinecritique_verification_token" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "cinecritique_verification_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "cinecritique_best_of" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "cinecritique_criteria_preset" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "cinecritique_criteria_preset" ADD COLUMN "is_global" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "cinecritique_movie_criteria_override" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "cinecritique_accounts" ADD CONSTRAINT "cinecritique_accounts_user_id_cinecritique_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cinecritique_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_movie_weighted_cache" ADD CONSTRAINT "cinecritique_movie_weighted_cache_movie_id_cinecritique_movie_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."cinecritique_movie"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_sessions" ADD CONSTRAINT "cinecritique_sessions_user_id_cinecritique_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cinecritique_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_best_of" ADD CONSTRAINT "cinecritique_best_of_user_id_cinecritique_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cinecritique_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_criteria_preset" ADD CONSTRAINT "cinecritique_criteria_preset_created_by_cinecritique_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."cinecritique_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_evaluation" ADD CONSTRAINT "cinecritique_evaluation_user_id_cinecritique_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cinecritique_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cinecritique_movie_criteria_override" ADD CONSTRAINT "cinecritique_movie_criteria_override_user_id_cinecritique_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."cinecritique_users"("id") ON DELETE no action ON UPDATE no action;