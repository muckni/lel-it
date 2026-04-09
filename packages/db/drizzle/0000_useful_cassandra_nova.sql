CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'under_review', 'agreed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('turbine', 'foundation', 'oss', 'onshore_substation', 'array_cable', 'export_cable', 'met_mast', 'other');--> statement-breakpoint
CREATE TYPE "public"."criticality" AS ENUM('critical', 'major', 'minor');--> statement-breakpoint
CREATE TYPE "public"."deliverable_status" AS ENUM('not_started', 'in_progress', 'submitted', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."discipline" AS ENUM('structural', 'electrical', 'mechanical', 'control_systems', 'marine', 'geotechnical', 'hse', 'other');--> statement-breakpoint
CREATE TYPE "public"."iq_response_status" AS ENUM('submitted', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."point_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."project_phase" AS ENUM('maturation', 'feed', 'detailed_design', 'procurement', 'fabrication', 'installation', 'commissioning', 'operations');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."query_priority" AS ENUM('urgent', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."query_status" AS ENUM('open', 'responded', 'accepted', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."register_status" AS ENUM('draft', 'active', 'closed');--> statement-breakpoint
CREATE TABLE "asset_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"label" text NOT NULL,
	"position_x" real DEFAULT 0 NOT NULL,
	"position_y" real DEFAULT 0 NOT NULL,
	"position_z" real DEFAULT 0 NOT NULL,
	"rotation_y" real DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_type" text NOT NULL,
	"parent_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"mentions" uuid[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interface_point_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"responsible_package_id" uuid,
	"status" "deliverable_status" DEFAULT 'not_started' NOT NULL,
	"due_date" date,
	"document_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"register_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"discipline" "discipline",
	"status" "agreement_status" DEFAULT 'draft' NOT NULL,
	"agreed_date" timestamp with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"criticality" "criticality" DEFAULT 'minor' NOT NULL,
	"status" "point_status" DEFAULT 'open' NOT NULL,
	"phase" "project_phase",
	"due_date" date,
	"asset_type" "asset_type",
	"asset_position_ref" text,
	"spatial_x" real,
	"spatial_y" real,
	"spatial_z" real,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interface_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interface_point_id" uuid NOT NULL,
	"code" text NOT NULL,
	"raised_by_package_id" uuid NOT NULL,
	"raised_by_user_id" uuid NOT NULL,
	"assigned_to_package_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"priority" "query_priority" DEFAULT 'medium' NOT NULL,
	"status" "query_status" DEFAULT 'open' NOT NULL,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "interface_registers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"package_a_id" uuid NOT NULL,
	"package_b_id" uuid NOT NULL,
	"status" "register_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "iq_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"responded_by_user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"status" "iq_response_status" DEFAULT 'submitted' NOT NULL,
	"document_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"message" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'viewer' NOT NULL,
	"work_package_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"phase" "project_phase" DEFAULT 'maturation' NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"responsible_org" text,
	"is_template" boolean DEFAULT false NOT NULL,
	"color" text DEFAULT '#6366F1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_placements" ADD CONSTRAINT "asset_placements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_interface_point_id_interface_points_id_fk" FOREIGN KEY ("interface_point_id") REFERENCES "public"."interface_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_responsible_package_id_work_packages_id_fk" FOREIGN KEY ("responsible_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_agreements" ADD CONSTRAINT "interface_agreements_register_id_interface_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."interface_registers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_points" ADD CONSTRAINT "interface_points_agreement_id_interface_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."interface_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_queries" ADD CONSTRAINT "interface_queries_interface_point_id_interface_points_id_fk" FOREIGN KEY ("interface_point_id") REFERENCES "public"."interface_points"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_queries" ADD CONSTRAINT "interface_queries_raised_by_package_id_work_packages_id_fk" FOREIGN KEY ("raised_by_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_queries" ADD CONSTRAINT "interface_queries_assigned_to_package_id_work_packages_id_fk" FOREIGN KEY ("assigned_to_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_registers" ADD CONSTRAINT "interface_registers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_registers" ADD CONSTRAINT "interface_registers_package_a_id_work_packages_id_fk" FOREIGN KEY ("package_a_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interface_registers" ADD CONSTRAINT "interface_registers_package_b_id_work_packages_id_fk" FOREIGN KEY ("package_b_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "iq_responses" ADD CONSTRAINT "iq_responses_query_id_interface_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."interface_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_work_package_id_work_packages_id_fk" FOREIGN KEY ("work_package_id") REFERENCES "public"."work_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_packages" ADD CONSTRAINT "work_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_placements_project_id_type_idx" ON "asset_placements" USING btree ("project_id","asset_type");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_type","parent_id","created_at");--> statement-breakpoint
CREATE INDEX "deliverables_interface_point_id_idx" ON "deliverables" USING btree ("interface_point_id");--> statement-breakpoint
CREATE INDEX "interface_agreements_register_id_idx" ON "interface_agreements" USING btree ("register_id");--> statement-breakpoint
CREATE INDEX "interface_points_agreement_id_status_idx" ON "interface_points" USING btree ("agreement_id","status");--> statement-breakpoint
CREATE INDEX "interface_queries_point_id_status_idx" ON "interface_queries" USING btree ("interface_point_id","status");--> statement-breakpoint
CREATE INDEX "interface_registers_project_id_idx" ON "interface_registers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "iq_responses_query_id_idx" ON "iq_responses" USING btree ("query_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_idx" ON "notifications" USING btree ("user_id","read","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_project_user_idx" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "projects_portfolio_id_idx" ON "projects" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "work_packages_project_id_idx" ON "work_packages" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_packages_project_code_idx" ON "work_packages" USING btree ("project_id","code");