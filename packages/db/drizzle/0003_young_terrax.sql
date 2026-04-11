CREATE TABLE "deadline_digest_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"digest_date" date NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deadline_digest_sends" ADD CONSTRAINT "deadline_digest_sends_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deadline_digest_unique_idx" ON "deadline_digest_sends" USING btree ("digest_date","project_id","user_id");--> statement-breakpoint
CREATE INDEX "deadline_digest_date_idx" ON "deadline_digest_sends" USING btree ("digest_date","project_id");
--> statement-breakpoint
CREATE OR REPLACE VIEW project_deadlines_v AS
SELECT
  ir.project_id,
  'interface_point'::text AS entity_type,
  ip.id AS entity_id,
  ip.title,
  ip.due_date,
  ip.status::text AS entity_status,
  ir.id AS register_id,
  ia.id AS agreement_id,
  ip.id AS point_id,
  NULL::uuid AS query_id
FROM interface_points ip
INNER JOIN interface_agreements ia ON ia.id = ip.agreement_id
INNER JOIN interface_registers ir ON ir.id = ia.register_id
WHERE ip.due_date IS NOT NULL

UNION ALL

SELECT
  ir.project_id,
  'deliverable'::text AS entity_type,
  d.id AS entity_id,
  d.title,
  d.due_date,
  d.status::text AS entity_status,
  ir.id AS register_id,
  ia.id AS agreement_id,
  ip.id AS point_id,
  NULL::uuid AS query_id
FROM deliverables d
INNER JOIN interface_points ip ON ip.id = d.interface_point_id
INNER JOIN interface_agreements ia ON ia.id = ip.agreement_id
INNER JOIN interface_registers ir ON ir.id = ia.register_id
WHERE d.due_date IS NOT NULL

UNION ALL

SELECT
  ir.project_id,
  'iq'::text AS entity_type,
  iq.id AS entity_id,
  iq.subject AS title,
  iq.due_date,
  iq.status::text AS entity_status,
  ir.id AS register_id,
  ia.id AS agreement_id,
  ip.id AS point_id,
  iq.id AS query_id
FROM interface_queries iq
INNER JOIN interface_points ip ON ip.id = iq.interface_point_id
INNER JOIN interface_agreements ia ON ia.id = ip.agreement_id
INNER JOIN interface_registers ir ON ir.id = ia.register_id
WHERE iq.due_date IS NOT NULL;
