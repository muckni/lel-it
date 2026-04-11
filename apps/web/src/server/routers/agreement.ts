import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, interfaceAgreements, interfaceRegisters } from "@owit/db";
import { eq, sql } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForAgreement, projectIdForRegister } from "@/server/lib/project-id";

const disciplineEnum = z.enum([
  "structural",
  "electrical",
  "mechanical",
  "control_systems",
  "marine",
  "geotechnical",
  "hse",
  "other",
]);

export const agreementRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ registerId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForRegister(input.registerId);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfaceAgreements.findMany({
        where: eq(interfaceAgreements.registerId, input.registerId),
        with: { points: true },
        orderBy: interfaceAgreements.code,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForAgreement(input.id);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfaceAgreements.findFirst({
        where: eq(interfaceAgreements.id, input.id),
        with: {
          register: { with: { packageA: true, packageB: true } },
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
        discipline: disciplineEnum.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForRegister(input.registerId);
      await requireRole(ctx.user.id, projectId, "editor");

      const register = await db.query.interfaceRegisters.findFirst({
        where: eq(interfaceRegisters.id, input.registerId),
      });
      if (!register) throw new Error("Register not found");

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
        discipline: disciplineEnum.optional(),
        status: z.enum(["draft", "under_review", "agreed", "superseded"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const projectId = await projectIdForAgreement(id);
      await requireRole(ctx.user.id, projectId, "editor");

      const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (data.status === "agreed") updateData.agreedDate = new Date();

      const [agreement] = await db
        .update(interfaceAgreements)
        .set(updateData)
        .where(eq(interfaceAgreements.id, id))
        .returning();
      return agreement;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForAgreement(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      await db.delete(interfaceAgreements).where(eq(interfaceAgreements.id, input.id));
      return { success: true };
    }),
});
