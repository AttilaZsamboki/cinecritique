/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'cinecritique_movie'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

-- ALTER TABLE "cinecritique_movie" DROP CONSTRAINT "<constraint_name>";--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ALTER COLUMN "imdb_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cinecritique_movie" ADD CONSTRAINT "cinecritique_movie_title_unique" UNIQUE("title");