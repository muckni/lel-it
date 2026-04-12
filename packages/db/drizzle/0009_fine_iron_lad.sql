CREATE TABLE "custom_anchor_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"asset_type" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"position_x" real NOT NULL,
	"position_y" real NOT NULL,
	"position_z" real NOT NULL,
	"normal_x" real,
	"normal_y" real,
	"normal_z" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_anchor_definitions" ADD CONSTRAINT "custom_anchor_definitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_anchor_project_asset_key_idx" ON "custom_anchor_definitions" USING btree ("project_id","asset_type","key");