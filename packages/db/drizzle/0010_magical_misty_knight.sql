CREATE TYPE "public"."ll_change_request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."ll_discipline" AS ENUM('engineering', 'procurement', 'construction', 'installation', 'commissioning', 'project_management', 'hse', 'commercial', 'other');--> statement-breakpoint
CREATE TYPE "public"."ll_status" AS ENUM('draft', 'validated', 'consolidated', 'closed');--> statement-breakpoint
CREATE TYPE "public"."ll_type" AS ENUM('problem', 'success', 'risk', 'improvement', 'process_deviation');--> statement-breakpoint
CREATE TABLE "lesson_learned_change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"proposer_id" uuid NOT NULL,
	"status" "ll_change_request_status" DEFAULT 'pending' NOT NULL,
	"proposed_title" text NOT NULL,
	"proposed_description" text NOT NULL,
	"proposed_recommendation" text,
	"proposed_type" "ll_type" NOT NULL,
	"proposed_discipline" "ll_discipline" NOT NULL,
	"proposed_project_phase" "project_phase",
	"proposed_work_package_id" uuid,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_learned_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"interface_point_id" uuid NOT NULL,
	"linked_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lessons_learned" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"recommendation" text,
	"type" "ll_type" DEFAULT 'problem' NOT NULL,
	"discipline" "ll_discipline" DEFAULT 'other' NOT NULL,
	"project_phase" "project_phase",
	"status" "ll_status" DEFAULT 'draft' NOT NULL,
	"author_id" uuid NOT NULL,
	"validated_by_id" uuid,
	"validated_at" timestamp with time zone,
	"consolidated_by_id" uuid,
	"consolidated_at" timestamp with time zone,
	"work_package_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lesson_learned_change_requests" ADD CONSTRAINT "lesson_learned_change_requests_lesson_id_lessons_learned_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons_learned"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_learned_change_requests" ADD CONSTRAINT "lesson_learned_change_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_learned_change_requests" ADD CONSTRAINT "lesson_learned_change_requests_proposed_work_package_id_work_packages_id_fk" FOREIGN KEY ("proposed_work_package_id") REFERENCES "public"."work_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_learned_points" ADD CONSTRAINT "lesson_learned_points_lesson_id_lessons_learned_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons_learned"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_learned_points" ADD CONSTRAINT "lesson_learned_points_interface_point_id_interface_points_id_fk" FOREIGN KEY ("interface_point_id") REFERENCES "public"."interface_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD CONSTRAINT "lessons_learned_work_package_id_work_packages_id_fk" FOREIGN KEY ("work_package_id") REFERENCES "public"."work_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_learned_change_requests_project_idx" ON "lesson_learned_change_requests" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "lesson_learned_change_requests_lesson_idx" ON "lesson_learned_change_requests" USING btree ("lesson_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_learned_points_unique_idx" ON "lesson_learned_points" USING btree ("lesson_id","interface_point_id");--> statement-breakpoint
CREATE INDEX "lesson_learned_points_lesson_idx" ON "lesson_learned_points" USING btree ("lesson_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_learned_points_point_idx" ON "lesson_learned_points" USING btree ("interface_point_id","created_at");--> statement-breakpoint
CREATE INDEX "lessons_learned_project_id_idx" ON "lessons_learned" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lessons_learned_project_status_idx" ON "lessons_learned" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "lessons_learned_project_discipline_idx" ON "lessons_learned" USING btree ("project_id","discipline");