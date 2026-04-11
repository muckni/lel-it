CREATE TYPE "public"."matrix_phase_column" AS ENUM('spec', 'des', 'sup', 'on_a', 'on_t', 'on_c', 'off_t', 'off_i', 'off_c');--> statement-breakpoint
CREATE TYPE "public"."tracker_item_status" AS ENUM('open', 'closed', 'info', 'hold', 'xclosed');--> statement-breakpoint
CREATE TYPE "public"."moc_status" AS ENUM('draft', 'under_review', 'approved', 'rejected', 'postponed', 'implemented', 'closed');--> statement-breakpoint
CREATE TYPE "public"."moc_implementation_status" AS ENUM('not_started', 'in_progress', 'implemented', 'audited');--> statement-breakpoint
CREATE TYPE "public"."moc_approval_level" AS ENUM('engineering_manager', 'epc_director', 'project_director', 'steerco_excom', 'additional');--> statement-breakpoint
CREATE TYPE "public"."moc_approval_decision" AS ENUM('pending', 'approved', 'rejected', 'postponed');--> statement-breakpoint

ALTER TABLE "interface_matrix_revisions" ADD COLUMN "source_document_ref" text;--> statement-breakpoint
ALTER TABLE "interface_matrix_revisions" ADD COLUMN "issued_for" text;--> statement-breakpoint
ALTER TABLE "interface_matrix_revisions" ADD COLUMN "prepared_by" text;--> statement-breakpoint
ALTER TABLE "interface_matrix_revisions" ADD COLUMN "checked_by" text;--> statement-breakpoint
ALTER TABLE "interface_matrix_revisions" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "interface_matrix_revisions" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interface_matrix_revisions" ADD COLUMN "effective_date" date;--> statement-breakpoint
ALTER TABLE "interface_matrix_revisions" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint

ALTER TABLE "interface_matrix_rows" ADD COLUMN "empl_internal_revision" integer;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD COLUMN "group_name" text;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD COLUMN "display_order" integer;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD COLUMN "parent_row_id" uuid;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "interface_matrix_rows_unique_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "interface_matrix_rows_unique_id_idx" ON "interface_matrix_rows" USING btree ("project_id","revision_id","interface_id");--> statement-breakpoint

CREATE TABLE "interface_matrix_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "row_id" uuid NOT NULL,
  "phase_column" "matrix_phase_column" NOT NULL,
  "organization_id" uuid,
  "is_responsible" boolean DEFAULT false NOT NULL,
  "is_not_relevant" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_matrix_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "revision_id" uuid NOT NULL,
  "xlsx_storage_path" text NOT NULL,
  "pdf_storage_path" text NOT NULL,
  "checksum_sha256" text NOT NULL,
  "generated_by" uuid NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "interface_tracker_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "external_id" text NOT NULL,
  "section_title" text,
  "status" "tracker_item_status" DEFAULT 'open' NOT NULL,
  "opened_on" date,
  "action_text" text,
  "action_owner_text" text,
  "who_text" text,
  "due_text_raw" text,
  "due_date" date,
  "impacted_text" text,
  "comments_text" text,
  "source_workbook" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_tracker_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "tracker_item_id" uuid NOT NULL,
  "event_date" date,
  "content" text NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_tracker_case_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "tracker_item_id" uuid NOT NULL,
  "case_id" uuid NOT NULL,
  "linked_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE "moc_changes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "moc_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "decision_log_ref" text,
  "threshold_flag" boolean DEFAULT false NOT NULL,
  "affects_multiple_packages" boolean DEFAULT false NOT NULL,
  "cost_impact_eur" real,
  "hseq_impact" boolean DEFAULT false NOT NULL,
  "schedule_impact" boolean DEFAULT false NOT NULL,
  "status" "moc_status" DEFAULT 'draft' NOT NULL,
  "implementation_status" "moc_implementation_status" DEFAULT 'not_started' NOT NULL,
  "audit_due_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moc_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "moc_change_id" uuid NOT NULL,
  "approval_level" "moc_approval_level" NOT NULL,
  "decision" "moc_approval_decision" DEFAULT 'pending' NOT NULL,
  "approver_member_id" uuid,
  "decided_at" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moc_entity_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "moc_change_id" uuid NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid NOT NULL,
  "linked_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_parent_row_id_interface_matrix_rows_id_fk" FOREIGN KEY ("parent_row_id") REFERENCES "public"."interface_matrix_rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_allocations" ADD CONSTRAINT "interface_matrix_allocations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_allocations" ADD CONSTRAINT "interface_matrix_allocations_row_id_interface_matrix_rows_id_fk" FOREIGN KEY ("row_id") REFERENCES "public"."interface_matrix_rows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_allocations" ADD CONSTRAINT "interface_matrix_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_packs" ADD CONSTRAINT "interface_matrix_packs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_packs" ADD CONSTRAINT "interface_matrix_packs_revision_id_interface_matrix_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."interface_matrix_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "interface_tracker_items" ADD CONSTRAINT "interface_tracker_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_tracker_events" ADD CONSTRAINT "interface_tracker_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_tracker_events" ADD CONSTRAINT "interface_tracker_events_tracker_item_id_interface_tracker_items_id_fk" FOREIGN KEY ("tracker_item_id") REFERENCES "public"."interface_tracker_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_tracker_case_links" ADD CONSTRAINT "interface_tracker_case_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_tracker_case_links" ADD CONSTRAINT "interface_tracker_case_links_tracker_item_id_interface_tracker_items_id_fk" FOREIGN KEY ("tracker_item_id") REFERENCES "public"."interface_tracker_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_tracker_case_links" ADD CONSTRAINT "interface_tracker_case_links_case_id_interface_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."interface_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "moc_changes" ADD CONSTRAINT "moc_changes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moc_approvals" ADD CONSTRAINT "moc_approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moc_approvals" ADD CONSTRAINT "moc_approvals_moc_change_id_moc_changes_id_fk" FOREIGN KEY ("moc_change_id") REFERENCES "public"."moc_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moc_approvals" ADD CONSTRAINT "moc_approvals_approver_member_id_project_members_id_fk" FOREIGN KEY ("approver_member_id") REFERENCES "public"."project_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moc_entity_links" ADD CONSTRAINT "moc_entity_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moc_entity_links" ADD CONSTRAINT "moc_entity_links_moc_change_id_moc_changes_id_fk" FOREIGN KEY ("moc_change_id") REFERENCES "public"."moc_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "interface_matrix_allocations_row_idx" ON "interface_matrix_allocations" USING btree ("row_id","phase_column");--> statement-breakpoint
CREATE INDEX "interface_matrix_allocations_project_idx" ON "interface_matrix_allocations" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "interface_matrix_packs_revision_idx" ON "interface_matrix_packs" USING btree ("revision_id","generated_at");--> statement-breakpoint

CREATE UNIQUE INDEX "interface_tracker_items_unique_idx" ON "interface_tracker_items" USING btree ("project_id","external_id","section_title");--> statement-breakpoint
CREATE INDEX "interface_tracker_items_status_idx" ON "interface_tracker_items" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "interface_tracker_events_item_idx" ON "interface_tracker_events" USING btree ("tracker_item_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interface_tracker_case_links_unique_idx" ON "interface_tracker_case_links" USING btree ("tracker_item_id","case_id");--> statement-breakpoint
CREATE INDEX "interface_tracker_case_links_project_idx" ON "interface_tracker_case_links" USING btree ("project_id","created_at");--> statement-breakpoint

CREATE UNIQUE INDEX "moc_changes_project_moc_id_idx" ON "moc_changes" USING btree ("project_id","moc_id");--> statement-breakpoint
CREATE INDEX "moc_changes_project_status_idx" ON "moc_changes" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "moc_approvals_unique_level_idx" ON "moc_approvals" USING btree ("moc_change_id","approval_level");--> statement-breakpoint
CREATE INDEX "moc_approvals_project_idx" ON "moc_approvals" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "moc_entity_links_unique_idx" ON "moc_entity_links" USING btree ("moc_change_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "moc_entity_links_project_idx" ON "moc_entity_links" USING btree ("project_id","created_at");
