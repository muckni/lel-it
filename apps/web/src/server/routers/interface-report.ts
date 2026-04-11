import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  interfaceAuditExports,
  interfaceCaseEvents,
  interfaceCases,
  interfaceMonthlyReports,
} from "@owit/db";
import { classifyDeadline, isEntityClosed } from "@owit/shared";
import { assertMember } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { getProjectMemberByUser, requireInterfaceRole } from "@/server/lib/interface-compliance";

async function requireReporter(projectId: string, userId: string) {
  await assertMember(userId, projectId);
  const member = await getProjectMemberByUser(projectId, userId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  await requireInterfaceRole(member.id, [
    "employer_interface_manager",
    "contractor_interface_manager",
    "interface_coordinator",
  ]);
  return member;
}

export const interfaceReportRouter = createTRPCRouter({
  monthlyProgress: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        year: z.number().int().min(2000).max(3000),
        month: z.number().int().min(1).max(12),
        organizationId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const rangeStart = new Date(Date.UTC(input.year, input.month - 1, 1));
      const rangeEnd = new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59));

      const baseWhere = [eq(interfaceCases.projectId, input.projectId)];
      if (input.organizationId) {
        baseWhere.push(
          sql`(${interfaceCases.requestingOrganizationId} = ${input.organizationId}
          OR ${interfaceCases.providingOrganizationId} = ${input.organizationId}
          OR ${interfaceCases.responsibleOrganizationId} = ${input.organizationId})` as any
        );
      }

      const rows = await db.query.interfaceCases.findMany({
        where: and(...baseWhere),
      });

      const inPeriod = rows.filter(
        (row) => row.createdAt >= rangeStart && row.createdAt <= rangeEnd
      );

      const closedInPeriod = rows.filter(
        (row) => row.closedAt && row.closedAt >= rangeStart && row.closedAt <= rangeEnd
      );

      const overdue = rows.filter(
        (row) =>
          row.slaDueAt &&
          row.slaDueAt < new Date() &&
          row.currentState !== "closed"
      );

      return {
        totalOpen: rows.filter((row) => row.currentState !== "closed").length,
        createdInMonth: inPeriod.length,
        closedInMonth: closedInPeriod.length,
        overdueSla: overdue.length,
      };
    }),

  slaBreaches: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().int().min(1).max(500).default(100),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const now = new Date();
      return db.query.interfaceCases.findMany({
        where: and(
          eq(interfaceCases.projectId, input.projectId),
          lte(interfaceCases.slaDueAt, now),
          sql`${interfaceCases.currentState} <> 'closed'` as any
        ),
        orderBy: [sql`${interfaceCases.slaDueAt} ASC` as any],
        limit: input.limit,
      });
    }),

  complianceKpis: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const rows = await db.query.interfaceCases.findMany({
        where: eq(interfaceCases.projectId, input.projectId),
      });

      const closedRows = rows.filter((row) => row.closedAt);
      const cycleTimes = closedRows.map((row) => {
        const duration = row.closedAt!.getTime() - row.createdAt.getTime();
        return Math.max(0, Math.round(duration / 86400000));
      });

      const avgCycleTimeDays =
        cycleTimes.length === 0
          ? 0
          : Math.round(cycleTimes.reduce((sum, x) => sum + x, 0) / cycleTimes.length);

      const slaBreaches = rows.filter(
        (row) =>
          row.slaDueAt &&
          row.slaDueAt < new Date() &&
          row.currentState !== "closed"
      ).length;

      const reopenedCount = (
        await db.query.interfaceCaseEvents.findMany({
          where: and(
            eq(interfaceCaseEvents.projectId, input.projectId),
            eq(interfaceCaseEvents.eventType, "reopened")
          ),
          columns: { id: true },
        })
      ).length;

      const unresolvedCritical = rows.filter(
        (row) =>
          row.currentState !== "closed" &&
          classifyDeadline(row.dueDate, isEntityClosed("interface_point", null)) ===
            "overdue"
      ).length;

      return {
        totalCases: rows.length,
        openCases: rows.filter((row) => row.currentState !== "closed").length,
        slaBreaches,
        avgCycleTimeDays,
        reopenedCount,
        unresolvedCritical,
      };
    }),

  exportAudit: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const member = await requireReporter(input.projectId, ctx.user.id);
      const eventWhere = [eq(interfaceCaseEvents.projectId, input.projectId)];
      if (input.from) eventWhere.push(gte(interfaceCaseEvents.createdAt, new Date(input.from)));
      if (input.to) eventWhere.push(lte(interfaceCaseEvents.createdAt, new Date(input.to)));

      const events = await db.query.interfaceCaseEvents.findMany({
        where: and(...eventWhere),
        orderBy: [sql`${interfaceCaseEvents.createdAt} DESC` as any],
      });

      const cases = await db.query.interfaceCases.findMany({
        where: eq(interfaceCases.projectId, input.projectId),
      });

      const payload = {
        generatedAt: new Date().toISOString(),
        from: input.from ?? null,
        to: input.to ?? null,
        cases,
        events,
      };

      const [exportRow] = await db
        .insert(interfaceAuditExports)
        .values({
          projectId: input.projectId,
          exportType: "full_event_stream",
          requestedBy: ctx.user.id,
          payload,
        })
        .returning();

      await db
        .insert(interfaceMonthlyReports)
        .values({
          projectId: input.projectId,
          year: new Date().getUTCFullYear(),
          month: new Date().getUTCMonth() + 1,
          organizationId: null,
          generatedBy: ctx.user.id,
          payload: {
            reportType: "audit_export_snapshot",
            exportId: exportRow.id,
            actorMemberId: member.id,
          },
        })
        .onConflictDoNothing();

      return exportRow;
    }),
});
