ALTER TABLE "lessons_learned" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;
