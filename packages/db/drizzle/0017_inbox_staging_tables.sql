CREATE TYPE "public"."inbox_item_status" AS ENUM('new', 'assigned', 'discarded');
--> statement-breakpoint
CREATE TABLE "inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"subject" text DEFAULT '' NOT NULL,
	"text_body" text DEFAULT '' NOT NULL,
	"html_body" text,
	"status" "inbox_item_status" DEFAULT 'new' NOT NULL,
	"lesson_id" uuid,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox_item_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inbox_item_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_lesson_id_lessons_v2_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons_v2"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbox_item_attachments" ADD CONSTRAINT "inbox_item_attachments_inbox_item_id_inbox_items_id_fk" FOREIGN KEY ("inbox_item_id") REFERENCES "public"."inbox_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_items_message_id_idx" ON "inbox_items" USING btree ("message_id");
--> statement-breakpoint
CREATE INDEX "inbox_items_user_status_idx" ON "inbox_items" USING btree ("user_id","status","received_at");
--> statement-breakpoint
CREATE INDEX "inbox_item_attachments_item_idx" ON "inbox_item_attachments" USING btree ("inbox_item_id");
