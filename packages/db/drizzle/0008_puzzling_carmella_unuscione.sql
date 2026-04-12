CREATE TABLE "cable_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"cable_type" text NOT NULL,
	"from_asset_id" uuid NOT NULL,
	"to_asset_id" uuid NOT NULL,
	"label" text NOT NULL,
	"color" text,
	"waypoints" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cable_routes" ADD CONSTRAINT "cable_routes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cable_routes" ADD CONSTRAINT "cable_routes_from_asset_id_asset_placements_id_fk" FOREIGN KEY ("from_asset_id") REFERENCES "public"."asset_placements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cable_routes" ADD CONSTRAINT "cable_routes_to_asset_id_asset_placements_id_fk" FOREIGN KEY ("to_asset_id") REFERENCES "public"."asset_placements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cable_routes_project_id_idx" ON "cable_routes" USING btree ("project_id");