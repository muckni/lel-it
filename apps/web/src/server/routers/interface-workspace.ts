import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  interfaceCases,
  interfaceMatrixAllocations,
  interfaceMatrixRevisions,
  interfaceMatrixRows,
  interfaceTrackerItems,
  mocChanges,
} from "@owit/db";
import type { InterfaceWorkspaceOverview, MatrixValidationIssue } from "@owit/shared";
import { assertMember } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const REQUIRED_PHASE_COLUMNS = ["spec", "des", "sup"] as const;

export const interfaceWorkspaceRouter = createTRPCRouter({
  getOverview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        revisionId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      let revisionId = input.revisionId ?? null;
      if (!revisionId) {
        const latest = await db.query.interfaceMatrixRevisions.findFirst({
          where: eq(interfaceMatrixRevisions.projectId, input.projectId),
          orderBy: (t, { desc }) => [desc(t.publishedAt), desc(t.createdAt)],
        });
        revisionId = latest?.id ?? null;
      }

      const [openCases, overdueCases, trackerOpen, mocUnderReview] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(interfaceCases)
          .where(
            and(
              eq(interfaceCases.projectId, input.projectId),
              sql`${interfaceCases.currentState} <> 'closed'`
            )
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(interfaceCases)
          .where(
            and(
              eq(interfaceCases.projectId, input.projectId),
              sql`${interfaceCases.currentState} <> 'closed'`,
              sql`${interfaceCases.slaDueAt} IS NOT NULL`,
              sql`${interfaceCases.slaDueAt} < now()`
            )
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(interfaceTrackerItems)
          .where(
            and(
              eq(interfaceTrackerItems.projectId, input.projectId),
              inArray(interfaceTrackerItems.status, ["open", "hold"])
            )
          ),
        db
          .select({ count: sql<number>`count(*)` })
          .from(mocChanges)
          .where(
            and(
              eq(mocChanges.projectId, input.projectId),
              eq(mocChanges.status, "under_review")
            )
          ),
      ]);

      let matrixRowsCount = 0;
      const issues: MatrixValidationIssue[] = [];

      if (revisionId) {
        const rows = await db.query.interfaceMatrixRows.findMany({
          where: and(
            eq(interfaceMatrixRows.projectId, input.projectId),
            eq(interfaceMatrixRows.revisionId, revisionId)
          ),
          columns: {
            id: true,
            interfaceId: true,
          },
        });
        matrixRowsCount = rows.length;

        if (rows.length > 0) {
          const rowIds = rows.map((row) => row.id);
          const allocations = await db.query.interfaceMatrixAllocations.findMany({
            where: inArray(interfaceMatrixAllocations.rowId, rowIds),
            orderBy: (t, { asc }) => [asc(t.sortOrder)],
          });

          const perRowPhase = new Map<string, typeof allocations>();
          for (const entry of allocations) {
            const key = `${entry.rowId}:${entry.phaseColumn}`;
            const list = perRowPhase.get(key) ?? [];
            list.push(entry);
            perRowPhase.set(key, list);

            if (!entry.isNotRelevant && !entry.organizationId) {
              issues.push({
                type: "unresolved_org_code",
                rowId: entry.rowId,
                phaseColumn: entry.phaseColumn,
                message: `Unresolved organization mapping in ${entry.phaseColumn}`,
              });
            }
          }

          for (const row of rows) {
            for (const phase of REQUIRED_PHASE_COLUMNS) {
              const key = `${row.id}:${phase}`;
              const entries = perRowPhase.get(key) ?? [];
              if (entries.length === 0) {
                issues.push({
                  type: "missing_required_allocation",
                  rowId: row.id,
                  phaseColumn: phase,
                  message: `Missing required allocation for ${phase}`,
                });
              }
              const responsible = entries.filter((x) => x.isResponsible && !x.isNotRelevant).length;
              if (responsible > 1) {
                issues.push({
                  type: "multi_responsible",
                  rowId: row.id,
                  phaseColumn: phase,
                  message: `Multiple responsible parties found for ${phase}`,
                });
              }
            }
          }
        }
      }

      const response: InterfaceWorkspaceOverview = {
        projectId: input.projectId,
        revisionId,
        counters: {
          openCases: Number(openCases[0]?.count ?? 0),
          overdueCases: Number(overdueCases[0]?.count ?? 0),
          trackerOpen: Number(trackerOpen[0]?.count ?? 0),
          matrixRows: matrixRowsCount,
          mocUnderReview: Number(mocUnderReview[0]?.count ?? 0),
        },
        blockingIssues: issues,
      };

      return response;
    }),

  listCaseLinks: protectedProcedure
    .input(z.object({ caseId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });
      }
      await assertMember(ctx.user.id, item.projectId);

      return {
        caseId: item.id,
        sourceEntityType: item.sourceEntityType,
        sourceEntityId: item.sourceEntityId,
      };
    }),
});
