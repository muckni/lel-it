import { addDays } from "date-fns";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, mocApprovals, mocChanges, mocEntityLinks } from "@owit/db";
import {
  MOC_APPROVAL_LEVELS,
  MOC_IMPLEMENTATION_STATUSES,
  MOC_STATUSES,
  resolveRequiredMocApprovalLevels,
} from "@owit/shared";
import { assertMember } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { getProjectMemberByUser, requireInterfaceRole } from "@/server/lib/interface-compliance";

const approvalLevelSchema = z.enum(MOC_APPROVAL_LEVELS);
const mocStatusSchema = z.enum(MOC_STATUSES);
const implementationStatusSchema = z.enum(MOC_IMPLEMENTATION_STATUSES);
const approvalDecisionSchema = z.enum(["pending", "approved", "rejected", "postponed"]);

async function requireMocManager(projectId: string, userId: string) {
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

export const mocRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        mocId: z.string().min(1).max(64),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        decisionLogRef: z.string().max(255).optional(),
        thresholdFlag: z.boolean().optional().default(false),
        affectsMultiplePackages: z.boolean().optional().default(false),
        costImpactEur: z.number().nonnegative().optional(),
        hseqImpact: z.boolean().optional().default(false),
        scheduleImpact: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireMocManager(input.projectId, ctx.user.id);

      const [created] = await db
        .insert(mocChanges)
        .values({
          projectId: input.projectId,
          mocId: input.mocId,
          title: input.title,
          description: input.description ?? null,
          decisionLogRef: input.decisionLogRef ?? null,
          thresholdFlag: input.thresholdFlag,
          affectsMultiplePackages: input.affectsMultiplePackages,
          costImpactEur: input.costImpactEur ?? null,
          hseqImpact: input.hseqImpact,
          scheduleImpact: input.scheduleImpact,
          status: "draft",
          implementationStatus: "not_started",
          createdBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [mocChanges.projectId, mocChanges.mocId],
          set: {
            title: input.title,
            description: input.description ?? null,
            decisionLogRef: input.decisionLogRef ?? null,
            thresholdFlag: input.thresholdFlag,
            affectsMultiplePackages: input.affectsMultiplePackages,
            costImpactEur: input.costImpactEur ?? null,
            hseqImpact: input.hseqImpact,
            scheduleImpact: input.scheduleImpact,
            updatedAt: new Date(),
          },
        })
        .returning();

      return created;
    }),

  startApproval: protectedProcedure
    .input(z.object({ mocChangeId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const moc = await db.query.mocChanges.findFirst({
        where: eq(mocChanges.id, input.mocChangeId),
      });
      if (!moc) throw new TRPCError({ code: "NOT_FOUND" });
      await requireMocManager(moc.projectId, ctx.user.id);

      const levels = resolveRequiredMocApprovalLevels({
        costImpactEur: moc.costImpactEur,
        scheduleImpact: moc.scheduleImpact,
        hseqImpact: moc.hseqImpact,
      });

      for (const level of levels) {
        // eslint-disable-next-line no-await-in-loop
        await db
          .insert(mocApprovals)
          .values({
            projectId: moc.projectId,
            mocChangeId: moc.id,
            approvalLevel: level,
            decision: "pending",
          })
          .onConflictDoNothing();
      }

      const [updated] = await db
        .update(mocChanges)
        .set({
          status: "under_review",
          updatedAt: new Date(),
        })
        .where(eq(mocChanges.id, moc.id))
        .returning();

      return {
        moc: updated,
        levels,
      };
    }),

  recordApprovalDecision: protectedProcedure
    .input(
      z.object({
        approvalId: z.string().uuid(),
        decision: approvalDecisionSchema,
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const approval = await db.query.mocApprovals.findFirst({
        where: eq(mocApprovals.id, input.approvalId),
      });
      if (!approval) throw new TRPCError({ code: "NOT_FOUND" });
      const member = await requireMocManager(approval.projectId, ctx.user.id);

      const [updatedApproval] = await db
        .update(mocApprovals)
        .set({
          decision: input.decision,
          notes: input.notes ?? null,
          approverMemberId: member.id,
          decidedAt: new Date(),
        })
        .where(eq(mocApprovals.id, approval.id))
        .returning();

      const allApprovals = await db.query.mocApprovals.findMany({
        where: eq(mocApprovals.mocChangeId, approval.mocChangeId),
      });

      let nextStatus: z.infer<typeof mocStatusSchema> = "under_review";
      if (allApprovals.some((row) => row.decision === "rejected")) {
        nextStatus = "rejected";
      } else if (allApprovals.some((row) => row.decision === "postponed")) {
        nextStatus = "postponed";
      } else if (allApprovals.every((row) => row.decision === "approved")) {
        nextStatus = "approved";
      }

      const [updatedMoc] = await db
        .update(mocChanges)
        .set({
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(mocChanges.id, approval.mocChangeId))
        .returning();

      return {
        approval: updatedApproval,
        moc: updatedMoc,
      };
    }),

  setImplementationStatus: protectedProcedure
    .input(
      z.object({
        mocChangeId: z.string().uuid(),
        implementationStatus: implementationStatusSchema,
        auditDueAt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const moc = await db.query.mocChanges.findFirst({
        where: eq(mocChanges.id, input.mocChangeId),
      });
      if (!moc) throw new TRPCError({ code: "NOT_FOUND" });
      await requireMocManager(moc.projectId, ctx.user.id);

      const isImplemented = input.implementationStatus === "implemented";
      const [updated] = await db
        .update(mocChanges)
        .set({
          implementationStatus: input.implementationStatus,
          status: isImplemented ? "implemented" : moc.status,
          auditDueAt: input.auditDueAt
            ? new Date(input.auditDueAt)
            : isImplemented
              ? addDays(new Date(), 30)
              : moc.auditDueAt,
          updatedAt: new Date(),
        })
        .where(eq(mocChanges.id, moc.id))
        .returning();

      return updated;
    }),

  linkEntity: protectedProcedure
    .input(
      z.object({
        mocChangeId: z.string().uuid(),
        entityType: z.enum(["interface_case", "interface_matrix_row", "tracker_item"]),
        entityId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const moc = await db.query.mocChanges.findFirst({
        where: eq(mocChanges.id, input.mocChangeId),
      });
      if (!moc) throw new TRPCError({ code: "NOT_FOUND" });
      await requireMocManager(moc.projectId, ctx.user.id);

      const [link] = await db
        .insert(mocEntityLinks)
        .values({
          projectId: moc.projectId,
          mocChangeId: moc.id,
          entityType: input.entityType,
          entityId: input.entityId,
          linkedBy: ctx.user.id,
        })
        .onConflictDoNothing()
        .returning();

      return link ?? { mocChangeId: moc.id, entityType: input.entityType, entityId: input.entityId };
    }),

  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: mocStatusSchema.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const where = input.status
        ? and(eq(mocChanges.projectId, input.projectId), eq(mocChanges.status, input.status))
        : eq(mocChanges.projectId, input.projectId);

      const items = await db.query.mocChanges.findMany({
        where,
        orderBy: [desc(mocChanges.updatedAt)],
      });

      if (items.length === 0) {
        return [];
      }

      const ids = items.map((item) => item.id);
      const [approvals, links] = await Promise.all([
        db.query.mocApprovals.findMany({
          where: inArray(mocApprovals.mocChangeId, ids),
          orderBy: [desc(mocApprovals.createdAt)],
        }),
        db.query.mocEntityLinks.findMany({
          where: inArray(mocEntityLinks.mocChangeId, ids),
          orderBy: [desc(mocEntityLinks.createdAt)],
        }),
      ]);

      const approvalsByMoc = new Map<string, typeof approvals>();
      for (const approval of approvals) {
        const list = approvalsByMoc.get(approval.mocChangeId) ?? [];
        list.push(approval);
        approvalsByMoc.set(approval.mocChangeId, list);
      }

      const linksByMoc = new Map<string, typeof links>();
      for (const link of links) {
        const list = linksByMoc.get(link.mocChangeId) ?? [];
        list.push(link);
        linksByMoc.set(link.mocChangeId, list);
      }

      return items.map((item) => ({
        ...item,
        approvals: approvalsByMoc.get(item.id) ?? [],
        links: linksByMoc.get(item.id) ?? [],
      }));
    }),
});
