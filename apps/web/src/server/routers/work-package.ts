import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, workPackages } from "@owit/db";
import { eq } from "drizzle-orm";
import { DEFAULT_WORK_PACKAGES } from "@owit/shared";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForWorkPackage } from "@/server/lib/project-id";

export const workPackageRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.workPackages.findMany({
        where: eq(workPackages.projectId, input.projectId),
        orderBy: workPackages.code,
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        code: z.string().min(1).max(10),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        responsibleOrg: z.string().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      const [wp] = await db.insert(workPackages).values(input).returning();
      return wp;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        code: z.string().min(1).max(10).optional(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        responsibleOrg: z.string().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const projectId = await projectIdForWorkPackage(id);
      await requireRole(ctx.user.id, projectId, "editor");
      const [wp] = await db
        .update(workPackages)
        .set(data)
        .where(eq(workPackages.id, id))
        .returning();
      return wp;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForWorkPackage(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      await db.delete(workPackages).where(eq(workPackages.id, input.id));
      return { success: true };
    }),

  seedDefaults: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      const values = DEFAULT_WORK_PACKAGES.map((wp) => ({
        projectId: input.projectId,
        code: wp.code,
        name: wp.name,
        color: wp.color,
      }));
      const result = await db
        .insert(workPackages)
        .values(values)
        .onConflictDoNothing()
        .returning();
      return result;
    }),
});
