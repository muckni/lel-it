import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  db,
  interfacePoints,
  interfaceAgreements,
  interfaceRegisters,
} from "@owit/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForAgreement, projectIdForPoint } from "@/server/lib/project-id";

const phaseEnum = z.enum([
  "maturation",
  "feed",
  "detailed_design",
  "procurement",
  "fabrication",
  "installation",
  "commissioning",
  "operations",
]);

export const interfacePointRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ agreementId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForAgreement(input.agreementId);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfacePoints.findMany({
        where: eq(interfacePoints.agreementId, input.agreementId),
        with: { deliverables: true, queries: true },
        orderBy: interfacePoints.code,
      });
    }),

  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
        criticality: z.enum(["critical", "major", "minor"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const registers = await db.query.interfaceRegisters.findMany({
        where: eq(interfaceRegisters.projectId, input.projectId),
        columns: { id: true },
      });
      if (registers.length === 0) return [];

      const agreements = await db.query.interfaceAgreements.findMany({
        where: inArray(interfaceAgreements.registerId, registers.map((r) => r.id)),
        columns: { id: true },
      });
      if (agreements.length === 0) return [];

      const agreementIds = agreements.map((a) => a.id);
      const conditions = [inArray(interfacePoints.agreementId, agreementIds)];
      if (input.status) conditions.push(eq(interfacePoints.status, input.status));
      if (input.criticality) conditions.push(eq(interfacePoints.criticality, input.criticality));

      return db.query.interfacePoints.findMany({
        where: and(...conditions),
        with: {
          agreement: {
            with: { register: { with: { packageA: true, packageB: true } } },
          },
          deliverables: true,
          queries: true,
        },
        orderBy: interfacePoints.code,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForPoint(input.id);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfacePoints.findFirst({
        where: eq(interfacePoints.id, input.id),
        with: {
          agreement: {
            with: { register: { with: { packageA: true, packageB: true } } },
          },
          deliverables: true,
          queries: { with: { responses: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        agreementId: z.string().uuid(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        criticality: z.enum(["critical", "major", "minor"]).default("minor"),
        phase: phaseEnum.optional(),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForAgreement(input.agreementId);
      await requireRole(ctx.user.id, projectId, "editor");

      const agreement = await db.query.interfaceAgreements.findFirst({
        where: eq(interfaceAgreements.id, input.agreementId),
      });
      if (!agreement) throw new Error("Agreement not found");

      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(interfacePoints)
        .where(eq(interfacePoints.agreementId, input.agreementId));
      const nextNum = Number(existing[0].count) + 1;
      const code = `${agreement.code.replace("IA", "IP")}-${String(nextNum).padStart(3, "0")}`;

      const [point] = await db
        .insert(interfacePoints)
        .values({ ...input, code })
        .returning();
      return point;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        criticality: z.enum(["critical", "major", "minor"]).optional(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
        phase: phaseEnum.optional(),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const projectId = await projectIdForPoint(id);
      await requireRole(ctx.user.id, projectId, "editor");
      const [point] = await db
        .update(interfacePoints)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(interfacePoints.id, id))
        .returning();
      return point;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForPoint(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      await db.delete(interfacePoints).where(eq(interfacePoints.id, input.id));
      return { success: true };
    }),

  bulkCreate: protectedProcedure
    .input(
      z.object({
        agreementId: z.string().uuid(),
        rows: z.array(
          z.object({
            title: z.string().min(1).max(255),
            description: z.string().optional(),
            criticality: z.enum(["critical", "major", "minor"]).optional(),
            phase: phaseEnum.optional(),
            dueDate: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForAgreement(input.agreementId);
      await requireRole(ctx.user.id, projectId, "editor");

      const agreement = await db.query.interfaceAgreements.findFirst({
        where: eq(interfaceAgreements.id, input.agreementId),
      });
      if (!agreement) throw new Error("Agreement not found");

      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(interfacePoints)
        .where(eq(interfacePoints.agreementId, input.agreementId));
      let nextNum = Number(existing[0].count) + 1;

      const values = input.rows.map((row) => {
        const code = `${agreement.code.replace("IA", "IP")}-${String(nextNum).padStart(3, "0")}`;
        nextNum++;
        return {
          agreementId: input.agreementId,
          code,
          title: row.title,
          description: row.description ?? null,
          criticality: (row.criticality ?? "minor") as "critical" | "major" | "minor",
          phase: row.phase ?? null,
          dueDate: row.dueDate ?? null,
        };
      });

      await db.insert(interfacePoints).values(values);
      return { created: values.length };
    }),
});
