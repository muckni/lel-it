import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, interfaceAgreements, interfaceRegisters } from "@owit/db";
import { eq, sql } from "drizzle-orm";

export const agreementRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ registerId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.interfaceAgreements.findMany({
        where: eq(interfaceAgreements.registerId, input.registerId),
        with: {
          points: true,
        },
        orderBy: interfaceAgreements.code,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.interfaceAgreements.findFirst({
        where: eq(interfaceAgreements.id, input.id),
        with: {
          register: {
            with: {
              packageA: true,
              packageB: true,
            },
          },
          points: true,
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        registerId: z.string().uuid(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        discipline: z
          .enum([
            "structural",
            "electrical",
            "mechanical",
            "control_systems",
            "marine",
            "geotechnical",
            "hse",
            "other",
          ])
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Get register code for prefix
      const register = await db.query.interfaceRegisters.findFirst({
        where: eq(interfaceRegisters.id, input.registerId),
      });
      if (!register) throw new Error("Register not found");

      // Auto-generate code: IA-001-01
      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(interfaceAgreements)
        .where(eq(interfaceAgreements.registerId, input.registerId));
      const nextNum = Number(existing[0].count) + 1;
      const code = `${register.code.replace("IR", "IA")}-${String(nextNum).padStart(2, "0")}`;

      const [agreement] = await db
        .insert(interfaceAgreements)
        .values({ ...input, code })
        .returning();
      return agreement;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        discipline: z
          .enum([
            "structural",
            "electrical",
            "mechanical",
            "control_systems",
            "marine",
            "geotechnical",
            "hse",
            "other",
          ])
          .optional(),
        status: z
          .enum(["draft", "under_review", "agreed", "superseded"])
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (data.status === "agreed") {
        updateData.agreedDate = new Date();
      }
      const [agreement] = await db
        .update(interfaceAgreements)
        .set(updateData)
        .where(eq(interfaceAgreements.id, id))
        .returning();
      return agreement;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .delete(interfaceAgreements)
        .where(eq(interfaceAgreements.id, input.id));
      return { success: true };
    }),
});
