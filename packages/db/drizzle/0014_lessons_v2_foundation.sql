CREATE TYPE "corporate_role" AS ENUM ('corporate_admin', 'corporate_ll_manager', 'senior_management', 'corporate_viewer');--> statement-breakpoint
CREATE TYPE "project_lesson_role" AS ENUM ('ll_lead', 'reviewer', 'contributor', 'viewer');--> statement-breakpoint
CREATE TYPE "confidentiality_level" AS ENUM ('internal', 'confidential', 'strictly_confidential');--> statement-breakpoint
CREATE TYPE "reusability_level" AS ENUM ('project_specific', 'reusable_with_adaptation', 'universally_applicable');--> statement-breakpoint
CREATE TYPE "lesson_v2_status" AS ENUM ('draft', 'submitted', 'under_review', 'validated', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "lesson_cluster_status" AS ENUM ('draft', 'under_review', 'approved', 'archived');--> statement-breakpoint
CREATE TYPE "recommended_action_status" AS ENUM ('draft', 'project_approved', 'proposed_for_corporate', 'corporate_review', 'corporate_approved', 'corporate_rejected', 'retired', 'archived');--> statement-breakpoint
CREATE TYPE "corporate_action_status" AS ENUM ('active', 'under_review', 'retired');--> statement-breakpoint
CREATE TYPE "project_action_status" AS ENUM ('added_to_project', 'assigned', 'in_progress', 'blocked', 'implemented', 'evidence_submitted', 'verified', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "evidence_kind" AS ENUM ('file', 'link', 'note');--> statement-breakpoint
CREATE TYPE "lesson_comment_kind" AS ENUM ('comment', 'review_note');--> statement-breakpoint
CREATE TYPE "lesson_entity_type" AS ENUM ('lesson', 'lesson_cluster', 'recommended_action', 'corporate_recommended_action', 'project_action', 'project_membership', 'project');--> statement-breakpoint

CREATE TABLE "user_corporate_roles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "role" "corporate_role" DEFAULT 'corporate_viewer' NOT NULL,
  "assigned_by_id" uuid,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lesson_project_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "project_lesson_role" DEFAULT 'viewer' NOT NULL,
  "can_export" boolean DEFAULT false NOT NULL,
  "created_by_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lesson_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lesson_workstreams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lesson_gates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "name" text NOT NULL,
  "planned_date" date,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lessons_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text NOT NULL,
  "type" "ll_type" DEFAULT 'problem' NOT NULL,
  "category_id" uuid NOT NULL,
  "status" "lesson_v2_status" DEFAULT 'draft' NOT NULL,
  "author_id" uuid NOT NULL,
  "observed_date" date,
  "workstream_id" uuid,
  "package_ref" text,
  "project_phase" "project_phase",
  "gate_id" uuid,
  "impact_level" text,
  "root_cause" text,
  "source_organisation" text,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "confidentiality_level" "confidentiality_level" DEFAULT 'internal' NOT NULL,
  "duplicate_of_lesson_id" uuid,
  "validated_by_id" uuid,
  "validated_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lesson_clusters_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "name" text NOT NULL,
  "summary" text NOT NULL,
  "status" "lesson_cluster_status" DEFAULT 'draft' NOT NULL,
  "workstream_id" uuid,
  "project_phase" "project_phase",
  "root_cause" text,
  "impact_summary" text,
  "impact_cost_eur" integer,
  "impact_schedule_days" integer,
  "created_by_id" uuid NOT NULL,
  "approved_by_id" uuid,
  "approved_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lesson_cluster_links_v2" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cluster_id" uuid NOT NULL,
  "lesson_id" uuid NOT NULL,
  "added_by_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "recommended_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "title" text NOT NULL,
  "action_description" text NOT NULL,
  "implementation_guidance" text,
  "category_id" uuid NOT NULL,
  "status" "recommended_action_status" DEFAULT 'draft' NOT NULL,
  "reusability_level" "reusability_level" DEFAULT 'project_specific' NOT NULL,
  "confidentiality_level" "confidentiality_level" DEFAULT 'internal' NOT NULL,
  "source_lesson_id" uuid,
  "source_cluster_id" uuid,
  "is_corporate_candidate" boolean DEFAULT false NOT NULL,
  "corporate_action_id" uuid,
  "transfer_checklist" jsonb,
  "transfer_proposed_by_id" uuid,
  "transfer_proposed_at" timestamp with time zone,
  "corporate_review_by_id" uuid,
  "corporate_reviewed_at" timestamp with time zone,
  "corporate_review_note" text,
  "created_by_id" uuid NOT NULL,
  "approved_by_id" uuid,
  "approved_at" timestamp with time zone,
  "retired_at" timestamp with time zone,
  "retired_reason" text,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "corporate_recommended_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "action_description" text NOT NULL,
  "implementation_guidance" text,
  "category_id" uuid NOT NULL,
  "status" "corporate_action_status" DEFAULT 'active' NOT NULL,
  "reusability_level" "reusability_level" DEFAULT 'reusable_with_adaptation' NOT NULL,
  "applicable_phases" "project_phase"[] DEFAULT '{}' NOT NULL,
  "applicable_workstreams" text[] DEFAULT '{}' NOT NULL,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "source_recommended_action_id" uuid NOT NULL,
  "source_project_id" uuid,
  "origin_summary" text,
  "source_project_visible_to_managers_only" boolean DEFAULT true NOT NULL,
  "published_by_id" uuid NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "retired_at" timestamp with time zone,
  "retired_reason" text,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "project_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "title" text NOT NULL,
  "action_description" text NOT NULL,
  "implementation_guidance" text,
  "category_id" uuid,
  "status" "project_action_status" DEFAULT 'added_to_project' NOT NULL,
  "source_corporate_action_id" uuid,
  "source_corporate_action_version" integer,
  "source_recommended_action_id" uuid,
  "current_owner_id" uuid,
  "deadline" date,
  "blocked_reason" text,
  "verified_by_id" uuid,
  "verified_at" timestamp with time zone,
  "closed_by_id" uuid,
  "closed_at" timestamp with time zone,
  "cancelled_reason" text,
  "duplicate_override_reason" text,
  "tags" text[] DEFAULT '{}' NOT NULL,
  "created_by_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "action_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_action_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "assigned_by_id" uuid NOT NULL,
  "deadline_at_assignment" date NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "superseded_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE "lesson_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid,
  "entity_type" "lesson_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "kind" "evidence_kind" NOT NULL,
  "file_name" text,
  "storage_path" text,
  "mime_type" text,
  "size_bytes" integer,
  "url" text,
  "note" text,
  "added_by_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lesson_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid,
  "entity_type" "lesson_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "body" text NOT NULL,
  "kind" "lesson_comment_kind" DEFAULT 'comment' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "lesson_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid,
  "entity_type" "lesson_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "actor_id" uuid NOT NULL,
  "actor_name" text,
  "from_status" text,
  "to_status" text,
  "note" text,
  "previous_value" jsonb,
  "new_value" jsonb,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "lesson_project_memberships" ADD CONSTRAINT "lesson_project_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_workstreams" ADD CONSTRAINT "lesson_workstreams_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_gates" ADD CONSTRAINT "lesson_gates_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_v2" ADD CONSTRAINT "lessons_v2_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_v2" ADD CONSTRAINT "lessons_v2_category_id_lesson_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."lesson_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_v2" ADD CONSTRAINT "lessons_v2_workstream_id_lesson_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."lesson_workstreams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons_v2" ADD CONSTRAINT "lessons_v2_gate_id_lesson_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."lesson_gates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_clusters_v2" ADD CONSTRAINT "lesson_clusters_v2_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_clusters_v2" ADD CONSTRAINT "lesson_clusters_v2_workstream_id_lesson_workstreams_id_fk" FOREIGN KEY ("workstream_id") REFERENCES "public"."lesson_workstreams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cluster_links_v2" ADD CONSTRAINT "lesson_cluster_links_v2_cluster_id_lesson_clusters_v2_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."lesson_clusters_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cluster_links_v2" ADD CONSTRAINT "lesson_cluster_links_v2_lesson_id_lessons_v2_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons_v2"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_actions" ADD CONSTRAINT "recommended_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_actions" ADD CONSTRAINT "recommended_actions_category_id_lesson_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."lesson_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_actions" ADD CONSTRAINT "recommended_actions_source_lesson_id_lessons_v2_id_fk" FOREIGN KEY ("source_lesson_id") REFERENCES "public"."lessons_v2"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommended_actions" ADD CONSTRAINT "recommended_actions_source_cluster_id_lesson_clusters_v2_id_fk" FOREIGN KEY ("source_cluster_id") REFERENCES "public"."lesson_clusters_v2"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_recommended_actions" ADD CONSTRAINT "corporate_recommended_actions_category_id_lesson_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."lesson_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_recommended_actions" ADD CONSTRAINT "corporate_recommended_actions_source_recommended_action_id_recommended_actions_id_fk" FOREIGN KEY ("source_recommended_action_id") REFERENCES "public"."recommended_actions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_recommended_actions" ADD CONSTRAINT "corporate_recommended_actions_source_project_id_projects_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_actions" ADD CONSTRAINT "project_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_actions" ADD CONSTRAINT "project_actions_category_id_lesson_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."lesson_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_actions" ADD CONSTRAINT "project_actions_source_corporate_action_id_corporate_recommended_actions_id_fk" FOREIGN KEY ("source_corporate_action_id") REFERENCES "public"."corporate_recommended_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_actions" ADD CONSTRAINT "project_actions_source_recommended_action_id_recommended_actions_id_fk" FOREIGN KEY ("source_recommended_action_id") REFERENCES "public"."recommended_actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_assignments" ADD CONSTRAINT "action_assignments_project_action_id_project_actions_id_fk" FOREIGN KEY ("project_action_id") REFERENCES "public"."project_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_assignments" ADD CONSTRAINT "action_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_evidence" ADD CONSTRAINT "lesson_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_comments" ADD CONSTRAINT "lesson_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_audit_log" ADD CONSTRAINT "lesson_audit_log_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "user_corporate_roles_role_idx" ON "user_corporate_roles" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_project_memberships_project_user_idx" ON "lesson_project_memberships" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "lesson_project_memberships_project_role_idx" ON "lesson_project_memberships" USING btree ("project_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_categories_name_idx" ON "lesson_categories" USING btree ("name");--> statement-breakpoint
CREATE INDEX "lesson_categories_active_idx" ON "lesson_categories" USING btree ("active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_workstreams_project_name_idx" ON "lesson_workstreams" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "lesson_workstreams_project_active_idx" ON "lesson_workstreams" USING btree ("project_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_gates_project_name_idx" ON "lesson_gates" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "lesson_gates_project_date_idx" ON "lesson_gates" USING btree ("project_id","planned_date");--> statement-breakpoint
CREATE INDEX "lessons_v2_project_status_idx" ON "lessons_v2" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "lessons_v2_project_category_idx" ON "lessons_v2" USING btree ("project_id","category_id");--> statement-breakpoint
CREATE INDEX "lessons_v2_project_workstream_idx" ON "lessons_v2" USING btree ("project_id","workstream_id");--> statement-breakpoint
CREATE INDEX "lessons_v2_project_gate_idx" ON "lessons_v2" USING btree ("project_id","gate_id");--> statement-breakpoint
CREATE INDEX "lessons_v2_author_idx" ON "lessons_v2" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_clusters_v2_project_status_idx" ON "lesson_clusters_v2" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "lesson_clusters_v2_project_workstream_idx" ON "lesson_clusters_v2" USING btree ("project_id","workstream_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_cluster_links_v2_unique_idx" ON "lesson_cluster_links_v2" USING btree ("cluster_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_cluster_links_v2_lesson_idx" ON "lesson_cluster_links_v2" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "recommended_actions_project_status_idx" ON "recommended_actions" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "recommended_actions_project_category_idx" ON "recommended_actions" USING btree ("project_id","category_id");--> statement-breakpoint
CREATE INDEX "recommended_actions_source_lesson_idx" ON "recommended_actions" USING btree ("source_lesson_id");--> statement-breakpoint
CREATE INDEX "recommended_actions_source_cluster_idx" ON "recommended_actions" USING btree ("source_cluster_id");--> statement-breakpoint
CREATE INDEX "recommended_actions_corporate_action_idx" ON "recommended_actions" USING btree ("corporate_action_id");--> statement-breakpoint
CREATE INDEX "corporate_recommended_actions_status_idx" ON "corporate_recommended_actions" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "corporate_recommended_actions_category_idx" ON "corporate_recommended_actions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "corporate_recommended_actions_source_idx" ON "corporate_recommended_actions" USING btree ("source_recommended_action_id");--> statement-breakpoint
CREATE INDEX "project_actions_project_status_idx" ON "project_actions" USING btree ("project_id","status","deadline");--> statement-breakpoint
CREATE INDEX "project_actions_project_owner_idx" ON "project_actions" USING btree ("project_id","current_owner_id");--> statement-breakpoint
CREATE INDEX "project_actions_source_corporate_idx" ON "project_actions" USING btree ("source_corporate_action_id","project_id");--> statement-breakpoint
CREATE INDEX "project_actions_source_recommended_idx" ON "project_actions" USING btree ("source_recommended_action_id","project_id");--> statement-breakpoint
CREATE INDEX "action_assignments_action_idx" ON "action_assignments" USING btree ("project_action_id","assigned_at");--> statement-breakpoint
CREATE INDEX "action_assignments_project_owner_idx" ON "action_assignments" USING btree ("project_id","owner_id");--> statement-breakpoint
CREATE INDEX "lesson_evidence_entity_idx" ON "lesson_evidence" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_evidence_project_idx" ON "lesson_evidence" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_evidence_storage_path_idx" ON "lesson_evidence" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "lesson_comments_entity_idx" ON "lesson_comments" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_comments_project_idx" ON "lesson_comments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_audit_log_entity_idx" ON "lesson_audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_audit_log_project_idx" ON "lesson_audit_log" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_audit_log_actor_idx" ON "lesson_audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_audit_log_event_idx" ON "lesson_audit_log" USING btree ("event_type","created_at");
