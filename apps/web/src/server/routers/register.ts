import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, interfaceRegisters, workPackages } from "@owit/db";
import { eq, sql } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForRegister } from "@/server/lib/project-id";

export const registerRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.interfaceRegisters.findMany({
        where: eq(interfaceRegisters.projectId, input.projectId),
        with: {
          packageA: true,
          packageB: true,
          agreements: { with: { points: true } },
        },
        orderBy: interfaceRegisters.code,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForRegister(input.id);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfaceRegisters.findFirst({
        where: eq(interfaceRegisters.id, input.id),
        with: {
          packageA: true,
          packageB: true,
          agreements: { with: { points: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(255),
        packageAId: z.string().uuid(),
        packageBId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");

      // Validate packages belong to this project
      const pkgs = await db.query.workPackages.findMany({
        where: eq(workPackages.projectId, input.projectId),
        columns: { id: true },
      });
      const pkgIds = new Set(pkgs.map((p) => p.id));
      if (!pkgIds.has(input.packageAId) || !pkgIds.has(input.packageBId)) {
        throw new Error("Work packages must belong to this project");
      }

      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(interfaceRegisters)
        .where(eq(interfaceRegisters.projectId, input.projectId));
      const nextNum = Number(existing[0].count) + 1;
      const code = `IR-${String(nextNum).padStart(3, "0")}`;

      const [register] = await db
        .insert(interfaceRegisters)
        .values({ ...input, code })
        .returning();
      return register;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        status: z.enum(["draft", "active", "closed"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const projectId = await projectIdForRegister(id);
      await requireRole(ctx.user.id, projectId, "editor");
      const [register] = await db
        .update(interfaceRegisters)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(interfaceRegisters.id, id))
        .returning();
      return register;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForRegister(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      await db.delete(interfaceRegisters).where(eq(interfaceRegisters.id, input.id));
      return { success: true };
    }),
});
