CREATE TABLE "model_registry_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL,
  "asset_type" "asset_type" NOT NULL,
  "semantic_tag" text,
  "version_label" text DEFAULT 'v1' NOT NULL,
  "file_name" text NOT NULL,
  "storage_path" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "is_active_version" boolean DEFAULT false NOT NULL,
  "uploaded_by_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_placements" ADD COLUMN "model_registry_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "asset_placements" ADD COLUMN "lod_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

ALTER TABLE "model_registry_assets" ADD CONSTRAINT "model_registry_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_placements" ADD CONSTRAINT "asset_placements_model_registry_asset_id_model_registry_assets_id_fk" FOREIGN KEY ("model_registry_asset_id") REFERENCES "public"."model_registry_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "model_registry_assets_project_idx" ON "model_registry_assets" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "model_registry_assets_type_idx" ON "model_registry_assets" USING btree ("project_id","asset_type");--> statement-breakpoint
CREATE UNIQUE INDEX "model_registry_assets_storage_path_idx" ON "model_registry_assets" USING btree ("storage_path");
