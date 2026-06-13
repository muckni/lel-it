import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  db,
  projects,
  projectMembers,
  lessonsV2,
  projectActions,
} from "@owit/db";
import { eq, and, notInArray, sql, count } from "drizzle-orm";
import { requireRole, getProjectRole, assertMember } from "@/server/lib/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

export const projectRouter = createTRPCRouter({
  // ── Queries ──────────────────────────────────────────────────────────────

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.id);
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.id),
      });
      if (!project) return null;

      const [memberCount] = await db
        .select({ count: count() })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.id));
      const [totalLessonsRow] = await db
        .select({ count: count() })
        .from(lessonsV2)
        .where(eq(lessonsV2.projectId, input.id));
      const [validatedLessonsRow] = await db
        .select({ count: count() })
        .from(lessonsV2)
        .where(
          and(
            eq(lessonsV2.projectId, input.id),
            eq(lessonsV2.status, "validated")
          )
        );
      const [openActionsRow] = await db
        .select({ count: count() })
        .from(projectActions)
        .where(
          and(
            eq(projectActions.projectId, input.id),
            notInArray(projectActions.status, ["closed", "cancelled"])
          )
        );

      return {
        ...project,
        memberCount: memberCount.count,
        stats: {
          totalLessons: totalLessonsRow.count,
          validatedLessons: validatedLessonsRow.count,
          openActions: openActionsRow.count,
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

      return member;
    }),

  updateMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        memberId: z.string().uuid(),
        role: z.enum(["admin", "editor", "viewer"]).optional(),
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
