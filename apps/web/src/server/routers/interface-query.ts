import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  db,
  interfaceQueries,
  iqResponses,
  interfacePoints,
  interfaceAgreements,
  interfaceRegisters,
} from "@owit/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForPoint, projectIdForQuery } from "@/server/lib/project-id";
import { logActivity } from "@/server/lib/log-activity";

export const interfaceQueryRouter = createTRPCRouter({
  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.string().optional(),
        priority: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const registers = await db
        .select({ id: interfaceRegisters.id })
        .from(interfaceRegisters)
        .where(eq(interfaceRegisters.projectId, input.projectId));
      if (registers.length === 0) return [];

      const agreements = await db
        .select({ id: interfaceAgreements.id })
        .from(interfaceAgreements)
        .where(inArray(interfaceAgreements.registerId, registers.map((r) => r.id)));
      if (agreements.length === 0) return [];

      const points = await db
        .select({ id: interfacePoints.id })
        .from(interfacePoints)
        .where(inArray(interfacePoints.agreementId, agreements.map((a) => a.id)));
      if (points.length === 0) return [];

      const conditions: ReturnType<typeof eq>[] = [
        inArray(interfaceQueries.interfacePointId, points.map((p) => p.id)),
      ];
      if (input.status && input.status !== "all") {
        conditions.push(
          eq(interfaceQueries.status, input.status as "open" | "responded" | "accepted" | "rejected" | "closed")
        );
      }
      if (input.priority && input.priority !== "all") {
        conditions.push(
          eq(interfaceQueries.priority, input.priority as "urgent" | "high" | "medium" | "low")
        );
      }

      return db.query.interfaceQueries.findMany({
        where: and(...conditions),
        with: {
          raisedByPackage: true,
          assignedToPackage: true,
          responses: true,
          interfacePoint: {
            with: { agreement: { with: { register: true } } },
          },
        },
        orderBy: (q, { desc }) => [desc(q.createdAt)],
      });
    }),

  listByPoint: protectedProcedure
    .input(z.object({ interfacePointId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForPoint(input.interfacePointId);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfaceQueries.findMany({
        where: eq(interfaceQueries.interfacePointId, input.interfacePointId),
        with: { raisedByPackage: true, assignedToPackage: true, responses: true },
        orderBy: (q, { desc }) => [desc(q.createdAt)],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForQuery(input.id);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfaceQueries.findFirst({
        where: eq(interfaceQueries.id, input.id),
        with: {
          raisedByPackage: true,
          assignedToPackage: true,
          responses: true,
          interfacePoint: {
            with: {
              agreement: {
                with: { register: { with: { packageA: true, packageB: true } } },
              },
            },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        interfacePointId: z.string().uuid(),
        raisedByPackageId: z.string().uuid(),
        assignedToPackageId: z.string().uuid(),
        subject: z.string().min(1).max(255),
        description: z.string().optional(),
        priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForPoint(input.interfacePointId);
      await requireRole(ctx.user.id, projectId, "editor");

      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(interfaceQueries)
        .where(eq(interfaceQueries.interfacePointId, input.interfacePointId));
      const nextNum = Number(existing[0].count) + 1;
      const code = `IQ-${String(nextNum).padStart(3, "0")}`;

      const [query] = await db
        .insert(interfaceQueries)
        .values({
          ...input,
          code,
          raisedByUserId: ctx.user.id,
          dueDate: input.dueDate || null,
        })
        .returning();

      logActivity({
        projectId,
        userId: ctx.user.id,
        actorName: ctx.user.email ?? "Unknown",
        eventType: "iq.raised",
        entityType: "interface_query",
        entityId: query.id,
        entityLabel: `${code}: ${input.subject}`,
        notificationMessage: `New IQ raised: ${code} — ${input.subject}`,
      }).catch(() => {});

      return query;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["open", "responded", "accepted", "rejected", "closed"]).optional(),
        priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
        dueDate: z.string().optional(),
        assignedToPackageId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const projectId = await projectIdForQuery(id);
      await requireRole(ctx.user.id, projectId, "editor");
      const updateData: Record<string, unknown> = { ...data };
      if (data.status === "closed") updateData.closedAt = new Date();
      const [query] = await db
        .update(interfaceQueries)
        .set(updateData)
        .where(eq(interfaceQueries.id, id))
        .returning();
      return query;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForQuery(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      await db.delete(interfaceQueries).where(eq(interfaceQueries.id, input.id));
      return { success: true };
    }),

  respond: protectedProcedure
    .input(
      z.object({
        queryId: z.string().uuid(),
        content: z.string().min(1),
        documentRef: z.string().url().optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForQuery(input.queryId);
      await requireRole(ctx.user.id, projectId, "editor");

      const [response] = await db
        .insert(iqResponses)
        .values({
          queryId: input.queryId,
          respondedByUserId: ctx.user.id,
          content: input.content,
          documentRef: input.documentRef || null,
        })
        .returning();

      const [updatedQuery] = await db
        .update(interfaceQueries)
        .set({ status: "responded" })
        .where(eq(interfaceQueries.id, input.queryId))
        .returning();

      logActivity({
        projectId,
        userId: ctx.user.id,
        actorName: ctx.user.email ?? "Unknown",
        eventType: "iq.responded",
        entityType: "interface_query",
        entityId: input.queryId,
        entityLabel: updatedQuery?.code ?? input.queryId,
        notificationMessage: `IQ ${updatedQuery?.code ?? ""} has a new response`,
      }).catch(() => {});

      return response;
    }),

  resolveResponse: protectedProcedure
    .input(
      z.object({
        responseId: z.string().uuid(),
        queryId: z.string().uuid(),
        resolution: z.enum(["accepted", "rejected"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForQuery(input.queryId);
      await requireRole(ctx.user.id, projectId, "editor");

      await db
        .update(iqResponses)
        .set({ status: input.resolution })
        .where(eq(iqResponses.id, input.responseId));

      const [resolvedQuery] = await db
        .update(interfaceQueries)
        .set({ status: input.resolution })
        .where(eq(interfaceQueries.id, input.queryId))
        .returning();

      logActivity({
        projectId,
        userId: ctx.user.id,
        actorName: ctx.user.email ?? "Unknown",
        eventType: `iq.${input.resolution}`,
        entityType: "interface_query",
        entityId: input.queryId,
        entityLabel: resolvedQuery?.code ?? input.queryId,
        meta: { resolution: input.resolution },
        notificationMessage: `IQ ${resolvedQuery?.code ?? ""} response was ${input.resolution}`,
      }).catch(() => {});

      return { success: true };
    }),
});
