CREATE TYPE "public"."ll_ownership_state" AS ENUM('permissive', 'restricted', 'prohibited', 'unclear');--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD COLUMN "ownership_state" "ll_ownership_state" DEFAULT 'permissive' NOT NULL;--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD COLUMN "ownership_changed_by_id" uuid;--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD COLUMN "ownership_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD COLUMN "ownership_rationale" text;--> statement-breakpoint
CREATE INDEX "lessons_learned_project_ownership_idx" ON "lessons_learned" USING btree ("project_id","ownership_state");