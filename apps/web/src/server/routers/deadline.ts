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

export const deadlineRouter = createTRPCRouter({
  listByProject: protectedProcedure
    .input(inputSchema)
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const clauses = [sql`project_id = ${input.projectId}`];
      if (input.from) clauses.push(sql`due_date >= ${input.from}::date`);
      if (input.to) clauses.push(sql`due_date <= ${input.to}::date`);

      const rows = (await db.execute(sql`
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

      const rows = (await db.execute(sql`
        SELECT
          entity_type,
          due_date::text AS due_date,
          entity_status
        FROM project_deadlines_v
        WHERE project_id = ${input.projectId}
      `)) as unknown as Array<{
        entity_type: "interface_point" | "deliverable" | "iq";
        due_date: string;
        entity_status: string | null;
      }>;

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
