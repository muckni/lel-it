CREATE TYPE "public"."attachment_entity" AS ENUM('interface_point', 'deliverable', 'iq_response');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"entity_type" "attachment_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_storage_path_idx" ON "attachments" USING btree ("storage_path");--> statement-breakpoint
CREATE INDEX "attachments_project_id_idx" ON "attachments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id","created_at");
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/acad',
    'application/x-acad',
    'application/x-dwg',
    'image/vnd.dwg',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/tiff',
    'image/svg+xml'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
--> statement-breakpoint
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'attachments read by project members'
  ) THEN
    CREATE POLICY "attachments read by project members"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
      bucket_id = 'attachments'
      AND split_part(name, '/', 1) = 'projects'
      AND EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.project_id::text = split_part(name, '/', 2)
      )
    );
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'attachments upload by editors'
  ) THEN
    CREATE POLICY "attachments upload by editors"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'attachments'
      AND split_part(name, '/', 1) = 'projects'
      AND EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.project_id::text = split_part(name, '/', 2)
          AND pm.role IN ('editor', 'admin')
      )
    );
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'attachments delete by editors'
  ) THEN
    CREATE POLICY "attachments delete by editors"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'attachments'
      AND split_part(name, '/', 1) = 'projects'
      AND EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.user_id = auth.uid()
          AND pm.project_id::text = split_part(name, '/', 2)
          AND pm.role IN ('editor', 'admin')
      )
    );
  END IF;
END
$$;
