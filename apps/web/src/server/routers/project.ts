import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  db,
  projects,
  projectMembers,
  memberWorkPackages,
  workPackages,
  interfaceRegisters,
  interfaceAgreements,
  interfacePoints,
  interfaceQueries,
  lessonsLearned,
} from "@owit/db";
import { eq, and, inArray, sql, count } from "drizzle-orm";
import { requireRole, getProjectRole, assertMember } from "@/server/lib/rbac";
import { TRPCError } from "@trpc/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function validateWorkPackagesBelongToProject(
  workPackageIds: string[],
  projectId: string
): Promise<void> {
  const pkgs = await db.query.workPackages.findMany({
    where: eq(workPackages.projectId, projectId),
    columns: { id: true },
  });
  const valid = new Set(pkgs.map((p) => p.id));
  const invalid = workPackageIds.filter((id) => !valid.has(id));
  if (invalid.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Work packages do not belong to this project: ${invalid.join(", ")}`,
    });
  }
}

export const projectRouter = createTRPCRouter({
  // ── Queries ──────────────────────────────────────────────────────────────

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.id);
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
        with: { workPackages: { orderBy: workPackages.code } },
      });
      if (!project) return null;

      const [memberCount] = await db
        .select({ count: count() })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.id));
      const [totalLessonsRow] = await db
        .select({ count: count() })
        .from(lessonsLearned)
        .where(eq(lessonsLearned.projectId, input.id));
      const [validatedLessonsRow] = await db
        .select({ count: count() })
        .from(lessonsLearned)
        .where(
          and(
            eq(lessonsLearned.projectId, input.id),
            inArray(lessonsLearned.status, ["validated", "consolidated", "closed"])
          )
        );

      // Summary stats via report-style queries
      const registers = await db
        .select({ id: interfaceRegisters.id })
        .from(interfaceRegisters)
        .where(eq(interfaceRegisters.projectId, input.id));

      const registerIds = registers.map((r) => r.id);

      let totalPoints = 0;
      let criticalPoints = 0;
      let resolvedPoints = 0;
      let openIqs = 0;

      if (registerIds.length > 0) {
        const agreements = await db
          .select({ id: interfaceAgreements.id })
          .from(interfaceAgreements)
          .where(inArray(interfaceAgreements.registerId, registerIds));

        const agreementIds = agreements.map((a) => a.id);

        if (agreementIds.length > 0) {
          const [pts] = await db
            .select({ count: count() })
            .from(interfacePoints)
            .where(inArray(interfacePoints.agreementId, agreementIds));
          totalPoints = pts.count;

          const [critical] = await db
            .select({ count: count() })
            .from(interfacePoints)
            .where(
              and(
                inArray(interfacePoints.agreementId, agreementIds),
                eq(interfacePoints.criticality, "critical")
              )
            );
          criticalPoints = critical.count;

          const [resolved] = await db
            .select({ count: count() })
            .from(interfacePoints)
            .where(
              and(
                inArray(interfacePoints.agreementId, agreementIds),
                eq(interfacePoints.status, "resolved")
              )
            );
          resolvedPoints = resolved.count;

          const points = await db
            .select({ id: interfacePoints.id })
            .from(interfacePoints)
            .where(inArray(interfacePoints.agreementId, agreementIds));

          const pointIds = points.map((p) => p.id);
          if (pointIds.length > 0) {
            const [iqs] = await db
              .select({ count: count() })
              .from(interfaceQueries)
              .where(
                and(
                  inArray(interfaceQueries.interfacePointId, pointIds),
                  inArray(interfaceQueries.status, ["open", "responded"])
                )
              );
            openIqs = iqs.count;
          }
        }
      }

      return {
        ...project,
        memberCount: memberCount.count,
        stats: {
          totalPoints,
          criticalPoints,
          resolvedPoints,
          openIqs,
          totalLessons: totalLessonsRow.count,
          validatedLessons: validatedLessonsRow.count,
        },
      };
    }),

  /** Current user's role in a project */
  myRole: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const role = await getProjectRole(ctx.user.id, input.projectId);
      return { role };
    }),

  listMembers: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const members = await db.query.projectMembers.findMany({
        where: eq(projectMembers.projectId, input.projectId),
        with: {
          memberWorkPackages: {
            with: { workPackage: { columns: { id: true, code: true, name: true, color: true } } },
          },
        },
        orderBy: projectMembers.createdAt,
      });

      // Enrich with auth user data (email/name) via direct DB query on auth.users
      const userIds = members.map((m) => m.userId);
      let authUsers: Record<string, { email: string; name: string }> = {};

      if (userIds.length > 0) {
        // P1-1: safe parameterized query — no sql.raw string interpolation
        const rows = await db.execute(
          sql`SELECT id::text, email, raw_user_meta_data->>'full_name' AS name
              FROM auth.users
              WHERE id = ANY(${userIds}::uuid[])`
        );
        for (const row of rows as unknown as Array<{ id: string; email: string | null; name: string | null }>) {
          authUsers[row.id] = { email: row.email ?? "", name: row.name ?? row.email ?? "Unknown" };
        }
      }

      return members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        email: authUsers[m.userId]?.email ?? "—",
        name: authUsers[m.userId]?.name ?? "—",
        workPackages: m.memberWorkPackages.map((mwp) => mwp.workPackage),
        createdAt: m.createdAt,
      }));
    }),

  // ── Mutations ─────────────────────────────────────────────────────────────

  /** Invite by email — admin only. User must already have an account. */
  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
        workPackageIds: z.array(z.string().uuid()).default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "admin");

      // Look up user in auth.users via raw query (no service-role key needed)
      const result = await db.execute(
        sql`SELECT id::text, email FROM auth.users WHERE email = ${input.email} LIMIT 1`
      );
      const authUser = (result as any[])[0];
      if (!authUser) {
        throw new Error(`No account found for ${input.email}. Ask them to sign up first.`);
      }

      const [member] = await db
        .insert(projectMembers)
        .values({
          projectId: input.projectId,
          userId: authUser.id,
          role: input.role,
        })
        .onConflictDoUpdate({
          target: [projectMembers.projectId, projectMembers.userId],
          set: { role: input.role },
        })
        .returning();

      // P1-2: validate work packages belong to this project
      if (input.workPackageIds.length > 0) {
        await validateWorkPackagesBelongToProject(input.workPackageIds, input.projectId);
        await db
          .delete(memberWorkPackages)
          .where(eq(memberWorkPackages.memberId, member.id));
        await db.insert(memberWorkPackages).values(
          input.workPackageIds.map((wpId) => ({
            memberId: member.id,
            workPackageId: wpId,
          }))
        ).onConflictDoNothing();
      }

      return member;
    }),

  updateMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        memberId: z.string().uuid(),
        role: z.enum(["admin", "editor", "viewer"]).optional(),
        workPackageIds: z.array(z.string().uuid()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "admin");

      if (input.role) {
        await db
          .update(projectMembers)
          .set({ role: input.role })
          .where(
            and(
              eq(projectMembers.id, input.memberId),
              eq(projectMembers.projectId, input.projectId)
            )
          );
      }

      if (input.workPackageIds !== undefined) {
        // P1-2: validate packages belong to this project
        if (input.workPackageIds.length > 0) {
          await validateWorkPackagesBelongToProject(input.workPackageIds, input.projectId);
        }
        await db
          .delete(memberWorkPackages)
          .where(eq(memberWorkPackages.memberId, input.memberId));
        if (input.workPackageIds.length > 0) {
          await db.insert(memberWorkPackages).values(
            input.workPackageIds.map((wpId) => ({
              memberId: input.memberId,
              workPackageId: wpId,
            }))
          ).onConflictDoNothing();
        }
      }

      return { success: true };
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        memberId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "admin");
      await db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.id, input.memberId),
            eq(projectMembers.projectId, input.projectId)
          )
        );
      return { success: true };
    }),
});
