import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, deliverables } from "@owit/db";
import { eq } from "drizzle-orm";

export const deliverableRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ interfacePointId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.deliverables.findMany({
        where: eq(deliverables.interfacePointId, input.interfacePointId),
        with: {
          responsiblePackage: true,
        },
        orderBy: deliverables.createdAt,
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        interfacePointId: z.string().uuid(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        responsiblePackageId: z.string().uuid().optional(),
        dueDate: z.string().optional(),
        documentRef: z.string().url().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [deliverable] = await db
        .insert(deliverables)
        .values(input)
        .returning();
      return deliverable;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        responsiblePackageId: z.string().uuid().optional(),
        status: z
          .enum([
            "not_started",
            "in_progress",
            "submitted",
            "accepted",
            "rejected",
          ])
          .optional(),
        dueDate: z.string().optional(),
        documentRef: z.string().url().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [deliverable] = await db
        .update(deliverables)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(deliverables.id, id))
        .returning();
      return deliverable;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(deliverables).where(eq(deliverables.id, input.id));
      return { success: true };
    }),
});
