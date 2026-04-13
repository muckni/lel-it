import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  lessonPolicyProfiles,
  portfolios,
  projectLessonRoleAssignments,
  projectLessonPolicyAssignments,
  projects,
} from "@owit/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { requireLessonRole } from "@/server/lib/lesson-rbac";

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  trackAApprovalEur250k: z.number().int().min(1000).max(10_000_000).optional(),
  trackAApprovalEur1m: z.number().int().min(1000).max(100_000_000).optional(),
  monthlyTriageDay: z.number().int().min(1).max(28).optional(),
  preGateLeadWeeks: z.number().int().min(1).max(12).optional(),
  reminderSlaDays: z.number().int().min(1).max(30).optional(),
  active: z.boolean().optional(),
});

export const lessonPolicyRouter = createTRPCRouter({
  getProfile: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        columns: { portfolioId: true },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const profile = await db.query.lessonPolicyProfiles.findFirst({
        where: and(
          eq(lessonPolicyProfiles.portfolioId, project.portfolioId),
          eq(lessonPolicyProfiles.active, true)
        ),
        orderBy: [desc(lessonPolicyProfiles.updatedAt)],
      });

      if (profile) return profile;

      const [created] = await db
        .insert(lessonPolicyProfiles)
        .values({
          portfolioId: project.portfolioId,
          name: "Default Policy",
          trackAApprovalEur250k: 250000,
          trackAApprovalEur1m: 1000000,
          monthlyTriageDay: 1,
          preGateLeadWeeks: 6,
          reminderSlaDays: 5,
          active: true,
        })
        .returning();

      return created;
    }),

  updateProfile: protectedProcedure
    .input(updateSchema)
    .mutation(async ({ input, ctx }) => {
      const profile = await db.query.lessonPolicyProfiles.findFirst({
        where: eq(lessonPolicyProfiles.id, input.id),
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const portfolio = await db.query.portfolios.findFirst({
        where: eq(portfolios.id, profile.portfolioId!),
        columns: { ownerId: true },
      });

      if (!portfolio || portfolio.ownerId !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only portfolio owner can update lesson policies",
        });
      }

      if (
        input.trackAApprovalEur250k &&
        input.trackAApprovalEur1m &&
        input.trackAApprovalEur250k >= input.trackAApprovalEur1m
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "250k threshold must be lower than 1m threshold",
        });
      }

      const { id, ...patch } = input;
      const [updated] = await db
        .update(lessonPolicyProfiles)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(lessonPolicyProfiles.id, id))
        .returning();

      return updated;
    }),

  assignProjectRole: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        memberId: z.string().uuid(),
        roleType: z.enum(["ll_manager", "document_controller", "pmo_director", "hope"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "admin");

      const [row] = await db
        .insert(projectLessonRoleAssignments)
        .values({
          projectId: input.projectId,
          memberId: input.memberId,
          roleType: input.roleType,
          assignedBy: ctx.user.id,
        })
        .onConflictDoUpdate({
          target: [
            projectLessonRoleAssignments.projectId,
            projectLessonRoleAssignments.memberId,
            projectLessonRoleAssignments.roleType,
          ],
          set: {
            assignedBy: ctx.user.id,
          },
        })
        .returning();

      return row;
    }),

  assignProjectProfile: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        policyProfileId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "admin");

      const profile = await db.query.lessonPolicyProfiles.findFirst({
        where: eq(lessonPolicyProfiles.id, input.policyProfileId),
        columns: { id: true, portfolioId: true },
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Policy profile not found" });

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
        columns: { portfolioId: true },
      });
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      if (profile.portfolioId !== project.portfolioId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Policy profile must belong to the same portfolio",
        });
      }

      const [row] = await db
        .insert(projectLessonPolicyAssignments)
        .values({
          projectId: input.projectId,
          policyProfileId: input.policyProfileId,
          assignedBy: ctx.user.id,
        })
        .onConflictDoUpdate({
          target: [projectLessonPolicyAssignments.projectId],
          set: {
            policyProfileId: input.policyProfileId,
            assignedBy: ctx.user.id,
          },
        })
        .returning();

      return row;
    }),

  listProjectRoles: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director", "hope"]);

      return db.query.projectLessonRoleAssignments.findMany({
        where: eq(projectLessonRoleAssignments.projectId, input.projectId),
        with: {
          member: {
            columns: { id: true, userId: true, role: true },
          },
        },
      });
    }),
});
