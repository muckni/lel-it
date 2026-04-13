CREATE TYPE "public"."lesson_action_priority" AS ENUM('do', 'delay', 'delegate', 'drop');--> statement-breakpoint
CREATE TYPE "public"."lesson_action_status" AS ENUM('not_started', 'in_progress', 'done', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."lesson_cycle_state" AS ENUM('planned', 'active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."lesson_cycle_type" AS ENUM('monthly', 'pre_gate', 'ad_hoc');--> statement-breakpoint
CREATE TYPE "public"."lesson_escalation_status" AS ENUM('draft', 'submitted', 'acknowledged', 'assigned', 'closed');--> statement-breakpoint
CREATE TYPE "public"."lesson_role_type" AS ENUM('ll_manager', 'document_controller', 'pmo_director', 'hope');--> statement-breakpoint
CREATE TYPE "public"."lesson_triage_decision" AS ENUM('retain', 'drop', 'defer', 'hold', 'duplicate', 'external_context');--> statement-breakpoint
CREATE TYPE "public"."lesson_workflow_state" AS ENUM('ingested', 'triaged', 'clustered', 'classified', 'actioned', 'report_ready');--> statement-breakpoint
CREATE TABLE "lesson_action_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"evidence_type" text NOT NULL,
	"evidence_ref" text NOT NULL,
	"notes" text,
	"added_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_cluster_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cycle_id" uuid,
	"package_id" uuid,
	"cluster_name" text NOT NULL,
	"phase" "project_phase",
	"root_cause" text,
	"event_narrative" text,
	"impact_summary" text,
	"impact_cost_eur" integer,
	"impact_schedule_days" integer,
	"is_cross_package" boolean DEFAULT false NOT NULL,
	"track_type" text,
	"track_rationale" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"policy_profile_id" uuid,
	"cycle_type" "lesson_cycle_type" NOT NULL,
	"state" "lesson_cycle_state" DEFAULT 'planned' NOT NULL,
	"cycle_label" text NOT NULL,
	"starts_at" timestamp with time zone,
	"gate_date" date,
	"t_minus_6_at" timestamp with time zone,
	"t_minus_5_at" timestamp with time zone,
	"t_minus_4_at" timestamp with time zone,
	"t_minus_3_at" timestamp with time zone,
	"t_minus_2_at" timestamp with time zone,
	"t_minus_1_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_package_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cycle_id" uuid,
	"package_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"report_html_path" text NOT NULL,
	"report_pdf_path" text NOT NULL,
	"report_xlsx_path" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"generated_by" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_policy_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid,
	"name" text DEFAULT 'Default Policy' NOT NULL,
	"track_a_approval_eur_250k" integer DEFAULT 250000 NOT NULL,
	"track_a_approval_eur_1m" integer DEFAULT 1000000 NOT NULL,
	"monthly_triage_day" integer DEFAULT 1 NOT NULL,
	"pre_gate_lead_weeks" integer DEFAULT 6 NOT NULL,
	"reminder_sla_days" integer DEFAULT 5 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_track_a_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cycle_id" uuid,
	"lesson_id" uuid NOT NULL,
	"cluster_id" uuid,
	"owner_user_id" uuid,
	"approval_level" text,
	"priority" "lesson_action_priority" DEFAULT 'do' NOT NULL,
	"status" "lesson_action_status" DEFAULT 'not_started' NOT NULL,
	"action_text" text NOT NULL,
	"success_criteria" text,
	"due_at" timestamp with time zone,
	"estimated_cost_eur" integer,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_track_b_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cycle_id" uuid,
	"lesson_id" uuid NOT NULL,
	"cluster_id" uuid,
	"status" "lesson_escalation_status" DEFAULT 'draft' NOT NULL,
	"structural_issue" text NOT NULL,
	"proposed_corporate_action" text NOT NULL,
	"department_owner" text,
	"recommended_target_phase" "project_phase",
	"submitted_by" uuid,
	"submitted_at" timestamp with time zone,
	"acknowledged_by" uuid,
	"acknowledged_at" timestamp with time zone,
	"due_by" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_triage_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cycle_id" uuid,
	"lesson_id" uuid NOT NULL,
	"decision" "lesson_triage_decision" NOT NULL,
	"rationale" text NOT NULL,
	"duplicate_of_lesson_id" uuid,
	"defer_trigger" text,
	"reviewer_id" uuid NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_lesson_policy_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"policy_profile_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_lesson_role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role_type" "lesson_role_type" NOT NULL,
	"assigned_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD COLUMN "workflow_state" "lesson_workflow_state" DEFAULT 'ingested' NOT NULL;--> statement-breakpoint
ALTER TABLE "lesson_action_evidence" ADD CONSTRAINT "lesson_action_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_action_evidence" ADD CONSTRAINT "lesson_action_evidence_action_id_lesson_track_a_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."lesson_track_a_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cluster_items" ADD CONSTRAINT "lesson_cluster_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cluster_items" ADD CONSTRAINT "lesson_cluster_items_cluster_id_lesson_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."lesson_clusters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cluster_items" ADD CONSTRAINT "lesson_cluster_items_lesson_id_lessons_learned_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons_learned"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_clusters" ADD CONSTRAINT "lesson_clusters_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_clusters" ADD CONSTRAINT "lesson_clusters_cycle_id_lesson_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."lesson_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_clusters" ADD CONSTRAINT "lesson_clusters_package_id_work_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."work_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cycles" ADD CONSTRAINT "lesson_cycles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_cycles" ADD CONSTRAINT "lesson_cycles_policy_profile_id_lesson_policy_profiles_id_fk" FOREIGN KEY ("policy_profile_id") REFERENCES "public"."lesson_policy_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_package_reports" ADD CONSTRAINT "lesson_package_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_package_reports" ADD CONSTRAINT "lesson_package_reports_cycle_id_lesson_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."lesson_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_package_reports" ADD CONSTRAINT "lesson_package_reports_package_id_work_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."work_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_policy_profiles" ADD CONSTRAINT "lesson_policy_profiles_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_track_a_actions" ADD CONSTRAINT "lesson_track_a_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_track_a_actions" ADD CONSTRAINT "lesson_track_a_actions_cycle_id_lesson_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."lesson_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_track_a_actions" ADD CONSTRAINT "lesson_track_a_actions_lesson_id_lessons_learned_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons_learned"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_track_a_actions" ADD CONSTRAINT "lesson_track_a_actions_cluster_id_lesson_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."lesson_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_track_b_escalations" ADD CONSTRAINT "lesson_track_b_escalations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_track_b_escalations" ADD CONSTRAINT "lesson_track_b_escalations_cycle_id_lesson_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."lesson_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_track_b_escalations" ADD CONSTRAINT "lesson_track_b_escalations_lesson_id_lessons_learned_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons_learned"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_track_b_escalations" ADD CONSTRAINT "lesson_track_b_escalations_cluster_id_lesson_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."lesson_clusters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_triage_decisions" ADD CONSTRAINT "lesson_triage_decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_triage_decisions" ADD CONSTRAINT "lesson_triage_decisions_cycle_id_lesson_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."lesson_cycles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_triage_decisions" ADD CONSTRAINT "lesson_triage_decisions_lesson_id_lessons_learned_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons_learned"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_triage_decisions" ADD CONSTRAINT "lesson_triage_decisions_duplicate_of_lesson_id_lessons_learned_id_fk" FOREIGN KEY ("duplicate_of_lesson_id") REFERENCES "public"."lessons_learned"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_lesson_policy_assignments" ADD CONSTRAINT "project_lesson_policy_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_lesson_policy_assignments" ADD CONSTRAINT "project_lesson_policy_assignments_policy_profile_id_lesson_policy_profiles_id_fk" FOREIGN KEY ("policy_profile_id") REFERENCES "public"."lesson_policy_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_lesson_role_assignments" ADD CONSTRAINT "project_lesson_role_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_lesson_role_assignments" ADD CONSTRAINT "project_lesson_role_assignments_member_id_project_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."project_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lesson_action_evidence_project_action_idx" ON "lesson_action_evidence" USING btree ("project_id","action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_cluster_items_unique_idx" ON "lesson_cluster_items" USING btree ("cluster_id","lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_cluster_items_project_cluster_idx" ON "lesson_cluster_items" USING btree ("project_id","cluster_id");--> statement-breakpoint
CREATE INDEX "lesson_clusters_project_cycle_idx" ON "lesson_clusters" USING btree ("project_id","cycle_id","created_at");--> statement-breakpoint
CREATE INDEX "lesson_clusters_project_track_idx" ON "lesson_clusters" USING btree ("project_id","track_type");--> statement-breakpoint
CREATE INDEX "lesson_cycles_project_state_idx" ON "lesson_cycles" USING btree ("project_id","state","cycle_type");--> statement-breakpoint
CREATE INDEX "lesson_package_reports_project_cycle_idx" ON "lesson_package_reports" USING btree ("project_id","cycle_id","generated_at");--> statement-breakpoint
CREATE INDEX "lesson_policy_profiles_portfolio_idx" ON "lesson_policy_profiles" USING btree ("portfolio_id","active");--> statement-breakpoint
CREATE INDEX "lesson_track_a_actions_project_status_idx" ON "lesson_track_a_actions" USING btree ("project_id","status","due_at");--> statement-breakpoint
CREATE INDEX "lesson_track_a_actions_project_owner_idx" ON "lesson_track_a_actions" USING btree ("project_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "lesson_track_b_escalations_project_status_idx" ON "lesson_track_b_escalations" USING btree ("project_id","status","due_by");--> statement-breakpoint
CREATE UNIQUE INDEX "lesson_triage_decisions_lesson_unique_idx" ON "lesson_triage_decisions" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "lesson_triage_decisions_project_decision_idx" ON "lesson_triage_decisions" USING btree ("project_id","decision");--> statement-breakpoint
CREATE UNIQUE INDEX "project_lesson_policy_assignments_project_idx" ON "project_lesson_policy_assignments" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_lesson_role_unique_idx" ON "project_lesson_role_assignments" USING btree ("project_id","member_id","role_type");--> statement-breakpoint
CREATE INDEX "project_lesson_role_project_idx" ON "project_lesson_role_assignments" USING btree ("project_id","role_type");

-- Backfill existing lessons into workflow states.
-- By default all rows are "ingested". Matured lessons with recommendation text are marked "classified".
UPDATE "lessons_learned"
SET "workflow_state" = 'classified'
WHERE "status" IN ('validated', 'consolidated', 'closed')
  AND COALESCE(NULLIF(BTRIM("recommendation"), ''), NULL) IS NOT NULL;
