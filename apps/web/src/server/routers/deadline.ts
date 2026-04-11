import { z } from "zod";
import { sql } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db } from "@owit/db";
import { assertMember } from "@/server/lib/rbac";
import { classifyDeadline, isEntityClosed } from "@owit/shared";

const inputSchema = z.object({
  projectId: z.string().uuid(),
  from: z.string().optional(),
  to: z.string().optional(),
  includeClosed: z.boolean().optional().default(false),
});

type DeadlineRow = {
  project_id: string;
  entity_type: "interface_point" | "deliverable" | "iq";
  entity_id: string;
  title: string;
  due_date: string;
  entity_status: string | null;
  register_id: string | null;
  agreement_id: string | null;
  point_id: string | null;
  query_id: string | null;
};

type ListInput = z.infer<typeof inputSchema>;

function buildUrlPath(
  projectId: string,
  row: DeadlineRow
): string | null {
  if (row.entity_type === "iq" && row.query_id) {
    return `/projects/${projectId}/queries/${row.query_id}`;
  }

  const pointId = row.entity_type === "interface_point" ? row.entity_id : row.point_id;
  if (pointId && row.register_id && row.agreement_id) {
    return `/projects/${projectId}/registers/${row.register_id}/agreements/${row.agreement_id}/points/${pointId}`;
  }

  return null;
}

async function fetchFromView(input: ListInput): Promise<DeadlineRow[]> {
  const clauses = [sql`project_id = ${input.projectId}`];
  if (input.from) clauses.push(sql`due_date >= ${input.from}::date`);
  if (input.to) clauses.push(sql`due_date <= ${input.to}::date`);

  return (await db.execute(sql`
    SELECT
      project_id,
      entity_type,
      entity_id,
      title,
      due_date::text AS due_date,
      entity_status,
      register_id,
      agreement_id,
      point_id,
      query_id
    FROM project_deadlines_v
    WHERE ${sql.join(clauses, sql` AND `)}
    ORDER BY due_date ASC, title ASC
  `)) as unknown as DeadlineRow[];
}

async function fetchFromBaseTables(input: ListInput): Promise<DeadlineRow[]> {
  const pointClauses = [sql`ir.project_id = ${input.projectId}`, sql`ip.due_date IS NOT NULL`];
  const deliverableClauses = [sql`ir.project_id = ${input.projectId}`, sql`d.due_date IS NOT NULL`];
  const iqClauses = [sql`ir.project_id = ${input.projectId}`, sql`iq.due_date IS NOT NULL`];

  if (input.from) {
    pointClauses.push(sql`ip.due_date >= ${input.from}::date`);
    deliverableClauses.push(sql`d.due_date >= ${input.from}::date`);
    iqClauses.push(sql`iq.due_date >= ${input.from}::date`);
  }
  if (input.to) {
    pointClauses.push(sql`ip.due_date <= ${input.to}::date`);
    deliverableClauses.push(sql`d.due_date <= ${input.to}::date`);
    iqClauses.push(sql`iq.due_date <= ${input.to}::date`);
  }

  const points = (await db.execute(sql`
    SELECT
      ir.project_id,
      'interface_point'::text AS entity_type,
      ip.id AS entity_id,
      ip.title,
      ip.due_date::text AS due_date,
      ip.status::text AS entity_status,
      ir.id AS register_id,
      ia.id AS agreement_id,
      ip.id AS point_id,
      NULL::uuid AS query_id
    FROM interface_points ip
    INNER JOIN interface_agreements ia ON ia.id = ip.agreement_id
    INNER JOIN interface_registers ir ON ir.id = ia.register_id
    WHERE ${sql.join(pointClauses, sql` AND `)}
  `)) as unknown as DeadlineRow[];

  const deliverables = (await db.execute(sql`
    SELECT
      ir.project_id,
      'deliverable'::text AS entity_type,
      d.id AS entity_id,
      d.title,
      d.due_date::text AS due_date,
      d.status::text AS entity_status,
      ir.id AS register_id,
      ia.id AS agreement_id,
      ip.id AS point_id,
      NULL::uuid AS query_id
    FROM deliverables d
    INNER JOIN interface_points ip ON ip.id = d.interface_point_id
    INNER JOIN interface_agreements ia ON ia.id = ip.agreement_id
    INNER JOIN interface_registers ir ON ir.id = ia.register_id
    WHERE ${sql.join(deliverableClauses, sql` AND `)}
  `)) as unknown as DeadlineRow[];

  const iqs = (await db.execute(sql`
    SELECT
      ir.project_id,
      'iq'::text AS entity_type,
      iq.id AS entity_id,
      iq.subject AS title,
      iq.due_date::text AS due_date,
      iq.status::text AS entity_status,
      ir.id AS register_id,
      ia.id AS agreement_id,
      ip.id AS point_id,
      iq.id AS query_id
    FROM interface_queries iq
    INNER JOIN interface_points ip ON ip.id = iq.interface_point_id
    INNER JOIN interface_agreements ia ON ia.id = ip.agreement_id
    INNER JOIN interface_registers ir ON ir.id = ia.register_id
    WHERE ${sql.join(iqClauses, sql` AND `)}
  `)) as unknown as DeadlineRow[];

  return [...points, ...deliverables, ...iqs].sort((a, b) => {
    const dateCmp = a.due_date.localeCompare(b.due_date);
    return dateCmp !== 0 ? dateCmp : a.title.localeCompare(b.title);
  });
}

async function fetchDeadlineRows(input: ListInput): Promise<DeadlineRow[]> {
  try {
    return await fetchFromView(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    // Graceful fallback for environments where migration/view isn't applied yet.
    if (message.toLowerCase().includes("project_deadlines_v")) {
      return fetchFromBaseTables(input);
    }
    throw error;
  }
}

export const deadlineRouter = createTRPCRouter({
  listByProject: protectedProcedure
    .input(inputSchema)
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const rows = await fetchDeadlineRows(input);

      return rows
        .map((row) => {
          const closed = isEntityClosed(row.entity_type, row.entity_status);
          const bucket = classifyDeadline(
            row.due_date,
            closed
          );
          return {
            entityType: row.entity_type,
            entityId: row.entity_id,
            title: row.title,
            dueDate: row.due_date,
            status: row.entity_status,
            isClosed: closed,
            bucket,
            urlPath: buildUrlPath(input.projectId, row),
          };
        })
        .filter((row) => input.includeClosed || !row.isClosed);
    }),

  summary: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const rows = await fetchDeadlineRows({
        projectId: input.projectId,
        includeClosed: true,
      });

      const summary = {
        overdue: 0,
        dueToday: 0,
        dueSoon: 0,
        byType: {
          interface_point: { overdue: 0, dueToday: 0, dueSoon: 0 },
          deliverable: { overdue: 0, dueToday: 0, dueSoon: 0 },
          iq: { overdue: 0, dueToday: 0, dueSoon: 0 },
        },
      };

      for (const row of rows) {
        const bucket = classifyDeadline(
          row.due_date,
          isEntityClosed(row.entity_type, row.entity_status)
        );
        if (bucket === "none") continue;

        if (bucket === "overdue") {
          summary.overdue += 1;
          summary.byType[row.entity_type].overdue += 1;
        } else if (bucket === "due_today") {
          summary.dueToday += 1;
          summary.byType[row.entity_type].dueToday += 1;
        } else {
          summary.dueSoon += 1;
          summary.byType[row.entity_type].dueSoon += 1;
        }
      }

      return summary;
    }),
});
