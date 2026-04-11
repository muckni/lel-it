CREATE TYPE "public"."interface_case_event_type" AS ENUM('state_changed', 'comment_added', 'assignment_changed', 'sla_changed', 'employer_approval_granted', 'document_attached', 'closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."interface_case_state" AS ENUM('draft_dir', 'employer_validated', 'forwarded', 'answered', 'reviewed', 'accepted', 'closed', 'reopened');--> statement-breakpoint
CREATE TYPE "public"."interface_party_role" AS ENUM('employer_interface_manager', 'contractor_interface_manager', 'interface_coordinator', 'requesting_party', 'providing_party');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('employer', 'contractor', 'subcontractor');--> statement-breakpoint
CREATE TABLE "interface_audit_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"export_type" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"storage_path" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"event_type" "interface_case_event_type" NOT NULL,
	"from_state" "interface_case_state",
	"to_state" "interface_case_state",
	"actor_member_id" uuid,
	"actor_user_id" uuid NOT NULL,
	"summary" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_entity_type" text,
	"source_entity_id" uuid,
	"requesting_organization_id" uuid,
	"providing_organization_id" uuid,
	"responsible_organization_id" uuid,
	"requesting_party_member_id" uuid,
	"providing_party_member_id" uuid,
	"responsible_party_member_id" uuid,
	"employer_gate_required" boolean DEFAULT true NOT NULL,
	"employer_approval_id" uuid,
	"current_state" "interface_case_state" DEFAULT 'draft_dir' NOT NULL,
	"due_date" date,
	"sla_due_at" timestamp with time zone,
	"employer_validated_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_matrix_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"revision_label" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_matrix_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"interface_id" text NOT NULL,
	"group_code" text,
	"interface_component" text NOT NULL,
	"description" text,
	"spec_org_id" uuid,
	"des_org_id" uuid,
	"sup_org_id" uuid,
	"on_a_org_id" uuid,
	"on_t_org_id" uuid,
	"on_c_org_id" uuid,
	"off_t_org_id" uuid,
	"off_i_org_id" uuid,
	"off_c_org_id" uuid,
	"responsible_organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_meeting_attendance" (
	"meeting_id" uuid NOT NULL,
	"project_member_id" uuid NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	CONSTRAINT "interface_meeting_attendance_meeting_id_project_member_id_pk" PRIMARY KEY("meeting_id","project_member_id")
);
--> statement-breakpoint
CREATE TABLE "interface_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"meeting_type" text DEFAULT 'regular' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"agenda" text,
	"minutes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_monthly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"organization_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by" uuid NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "organization_type" NOT NULL,
	"abbreviation" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_member_organization_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_member_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"interface_role" "interface_party_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interface_audit_exports" ADD CONSTRAINT "interface_audit_exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_case_events" ADD CONSTRAINT "interface_case_events_case_id_interface_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."interface_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_case_events" ADD CONSTRAINT "interface_case_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_case_events" ADD CONSTRAINT "interface_case_events_actor_member_id_project_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."project_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_cases" ADD CONSTRAINT "interface_cases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_cases" ADD CONSTRAINT "interface_cases_requesting_organization_id_organizations_id_fk" FOREIGN KEY ("requesting_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_cases" ADD CONSTRAINT "interface_cases_providing_organization_id_organizations_id_fk" FOREIGN KEY ("providing_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_cases" ADD CONSTRAINT "interface_cases_responsible_organization_id_organizations_id_fk" FOREIGN KEY ("responsible_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_cases" ADD CONSTRAINT "interface_cases_requesting_party_member_id_project_members_id_fk" FOREIGN KEY ("requesting_party_member_id") REFERENCES "public"."project_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_cases" ADD CONSTRAINT "interface_cases_providing_party_member_id_project_members_id_fk" FOREIGN KEY ("providing_party_member_id") REFERENCES "public"."project_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_cases" ADD CONSTRAINT "interface_cases_responsible_party_member_id_project_members_id_fk" FOREIGN KEY ("responsible_party_member_id") REFERENCES "public"."project_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_revisions" ADD CONSTRAINT "interface_matrix_revisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_revision_id_interface_matrix_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."interface_matrix_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_spec_org_id_organizations_id_fk" FOREIGN KEY ("spec_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_des_org_id_organizations_id_fk" FOREIGN KEY ("des_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_sup_org_id_organizations_id_fk" FOREIGN KEY ("sup_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_on_a_org_id_organizations_id_fk" FOREIGN KEY ("on_a_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_on_t_org_id_organizations_id_fk" FOREIGN KEY ("on_t_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_on_c_org_id_organizations_id_fk" FOREIGN KEY ("on_c_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_off_t_org_id_organizations_id_fk" FOREIGN KEY ("off_t_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_off_i_org_id_organizations_id_fk" FOREIGN KEY ("off_i_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_off_c_org_id_organizations_id_fk" FOREIGN KEY ("off_c_org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_matrix_rows" ADD CONSTRAINT "interface_matrix_rows_responsible_organization_id_organizations_id_fk" FOREIGN KEY ("responsible_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_meeting_attendance" ADD CONSTRAINT "interface_meeting_attendance_meeting_id_interface_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."interface_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_meeting_attendance" ADD CONSTRAINT "interface_meeting_attendance_project_member_id_project_members_id_fk" FOREIGN KEY ("project_member_id") REFERENCES "public"."project_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_meetings" ADD CONSTRAINT "interface_meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_monthly_reports" ADD CONSTRAINT "interface_monthly_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_monthly_reports" ADD CONSTRAINT "interface_monthly_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member_organization_roles" ADD CONSTRAINT "project_member_organization_roles_project_member_id_project_members_id_fk" FOREIGN KEY ("project_member_id") REFERENCES "public"."project_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member_organization_roles" ADD CONSTRAINT "project_member_organization_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interface_audit_exports_project_idx" ON "interface_audit_exports" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "interface_case_events_case_idx" ON "interface_case_events" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "interface_case_events_project_idx" ON "interface_case_events" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "interface_cases_project_state_idx" ON "interface_cases" USING btree ("project_id","current_state");--> statement-breakpoint
CREATE INDEX "interface_cases_sla_idx" ON "interface_cases" USING btree ("project_id","sla_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interface_matrix_revision_unique_idx" ON "interface_matrix_revisions" USING btree ("project_id","revision_label");--> statement-breakpoint
CREATE UNIQUE INDEX "interface_matrix_rows_unique_id_idx" ON "interface_matrix_rows" USING btree ("project_id","interface_id");--> statement-breakpoint
CREATE INDEX "interface_matrix_rows_revision_idx" ON "interface_matrix_rows" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX "interface_meetings_project_idx" ON "interface_meetings" USING btree ("project_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interface_monthly_reports_unique_idx" ON "interface_monthly_reports" USING btree ("project_id","year","month","organization_id");--> statement-breakpoint
CREATE INDEX "organizations_project_idx" ON "organizations" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_project_name_idx" ON "organizations" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "member_org_roles_member_idx" ON "project_member_organization_roles" USING btree ("project_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_roles_unique_idx" ON "project_member_organization_roles" USING btree ("project_member_id","organization_id","interface_role");