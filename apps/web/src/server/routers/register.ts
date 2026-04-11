import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, interfaceRegisters, workPackages } from "@owit/db";
import { eq, sql, and } from "drizzle-orm";

export const registerRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.interfaceRegisters.findMany({
        where: eq(interfaceRegisters.projectId, input.projectId),
        with: {
          packageA: true,
          packageB: true,
          agreements: {
            with: { points: true },
          },
        },
        orderBy: interfaceRegisters.code,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.interfaceRegisters.findFirst({
        where: eq(interfaceRegisters.id, input.id),
        with: {
          packageA: true,
          packageB: true,
          agreements: {
            with: {
              points: true,
            },
          },
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
    .mutation(async ({ input }) => {
      // Auto-generate code: IR-001, IR-002, etc.
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
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [register] = await db
        .update(interfaceRegisters)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(interfaceRegisters.id, id))
        .returning();
      return register;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .delete(interfaceRegisters)
        .where(eq(interfaceRegisters.id, input.id));
      return { success: true };
    }),
});
