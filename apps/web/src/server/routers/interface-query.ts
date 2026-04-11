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
import { logActivity } from "@/server/lib/log-activity";

/** Resolve projectId from an interfacePointId via joins */
async function projectIdForPoint(pointId: string): Promise<string | null> {
  const point = await db.query.interfacePoints.findFirst({
    where: eq(interfacePoints.id, pointId),
    with: {
      agreement: {
        with: {
          register: { columns: { projectId: true } },
        },
      },
    },
  });
  return point?.agreement?.register?.projectId ?? null;
}

/** Resolve projectId from a queryId */
async function projectIdForQuery(queryId: string): Promise<string | null> {
  const query = await db.query.interfaceQueries.findFirst({
    where: eq(interfaceQueries.id, queryId),
    columns: { interfacePointId: true },
  });
  if (!query) return null;
  return projectIdForPoint(query.interfacePointId);
}

export const interfaceQueryRouter = createTRPCRouter({
  // All IQs for a project (via register → agreement → point → query join)
  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.string().optional(),
        priority: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      // Get all register IDs for the project
      const registers = await db
        .select({ id: interfaceRegisters.id })
        .from(interfaceRegisters)
        .where(eq(interfaceRegisters.projectId, input.projectId));

      if (registers.length === 0) return [];

      const registerIds = registers.map((r) => r.id);

      // Get all agreement IDs
      const agreements = await db
        .select({ id: interfaceAgreements.id })
        .from(interfaceAgreements)
        .where(inArray(interfaceAgreements.registerId, registerIds));

      if (agreements.length === 0) return [];

      const agreementIds = agreements.map((a) => a.id);

      // Get all point IDs
      const points = await db
        .select({ id: interfacePoints.id })
        .from(interfacePoints)
        .where(inArray(interfacePoints.agreementId, agreementIds));

      if (points.length === 0) return [];

      const pointIds = points.map((p) => p.id);

      // Build filter conditions
      const conditions = [inArray(interfaceQueries.interfacePointId, pointIds)];
      if (input.status && input.status !== "all") {
        conditions.push(
          eq(
            interfaceQueries.status,
            input.status as
              | "open"
              | "responded"
              | "accepted"
              | "rejected"
              | "closed"
          )
        );
      }
      if (input.priority && input.priority !== "all") {
        conditions.push(
          eq(
            interfaceQueries.priority,
            input.priority as "urgent" | "high" | "medium" | "low"
          )
        );
      }

      return db.query.interfaceQueries.findMany({
        where: and(...conditions),
        with: {
          raisedByPackage: true,
          assignedToPackage: true,
          responses: true,
          interfacePoint: {
            with: {
              agreement: {
                with: {
                  register: true,
                },
              },
            },
          },
        },
        orderBy: (q, { desc }) => [desc(q.createdAt)],
      });
    }),

  // IQs for a specific interface point
  listByPoint: protectedProcedure
    .input(z.object({ interfacePointId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.interfaceQueries.findMany({
        where: eq(interfaceQueries.interfacePointId, input.interfacePointId),
        with: {
          raisedByPackage: true,
          assignedToPackage: true,
          responses: true,
        },
        orderBy: (q, { desc }) => [desc(q.createdAt)],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.interfaceQueries.findFirst({
        where: eq(interfaceQueries.id, input.id),
        with: {
          raisedByPackage: true,
          assignedToPackage: true,
          responses: true,
          interfacePoint: {
            with: {
              agreement: {
                with: {
                  register: {
                    with: {
                      packageA: true,
                      packageB: true,
                    },
                  },
                },
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
      // Auto-generate code: IQ-001, IQ-002, etc. within the interface point
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
          raisedByUserId: ctx.user!.id,
          dueDate: input.dueDate || null,
        })
        .returning();

      // Log activity (non-blocking)
      projectIdForPoint(input.interfacePointId).then((projectId) => {
        if (!projectId) return;
        logActivity({
          projectId,
          userId: ctx.user!.id,
          actorName: ctx.user!.email ?? "Unknown",
          eventType: "iq.raised",
          entityType: "interface_query",
          entityId: query.id,
          entityLabel: `${code}: ${input.subject}`,
          notificationMessage: `New IQ raised: ${code} — ${input.subject}`,
        }).catch(() => {});
      });

      return query;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z
          .enum(["open", "responded", "accepted", "rejected", "closed"])
          .optional(),
        priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
        dueDate: z.string().optional(),
        assignedToPackageId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = { ...data };
      if (data.status === "closed") {
        updateData.closedAt = new Date();
      }
      const [query] = await db
        .update(interfaceQueries)
        .set(updateData)
        .where(eq(interfaceQueries.id, id))
        .returning();
      return query;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .delete(interfaceQueries)
        .where(eq(interfaceQueries.id, input.id));
      return { success: true };
    }),

  // Add a response to an IQ
  respond: protectedProcedure
    .input(
      z.object({
        queryId: z.string().uuid(),
        content: z.string().min(1),
        documentRef: z
          .string()
          .url()
          .optional()
          .or(z.literal("")),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [response] = await db
        .insert(iqResponses)
        .values({
          queryId: input.queryId,
          respondedByUserId: ctx.user!.id,
          content: input.content,
          documentRef: input.documentRef || null,
        })
        .returning();

      // Update IQ status to responded
      const [updatedQuery] = await db
        .update(interfaceQueries)
        .set({ status: "responded" })
        .where(eq(interfaceQueries.id, input.queryId))
        .returning();

      // Log activity (non-blocking)
      projectIdForQuery(input.queryId).then((projectId) => {
        if (!projectId) return;
        logActivity({
          projectId,
          userId: ctx.user!.id,
          actorName: ctx.user!.email ?? "Unknown",
          eventType: "iq.responded",
          entityType: "interface_query",
          entityId: input.queryId,
          entityLabel: updatedQuery?.code ?? input.queryId,
          notificationMessage: `IQ ${updatedQuery?.code ?? ""} has a new response`,
        }).catch(() => {});
      });

      return response;
    }),

  // Accept or reject a response
  resolveResponse: protectedProcedure
    .input(
      z.object({
        responseId: z.string().uuid(),
        queryId: z.string().uuid(),
        resolution: z.enum(["accepted", "rejected"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Update response status
      await db
        .update(iqResponses)
        .set({ status: input.resolution })
        .where(eq(iqResponses.id, input.responseId));

      // Update IQ status
      const [resolvedQuery] = await db
        .update(interfaceQueries)
        .set({ status: input.resolution })
        .where(eq(interfaceQueries.id, input.queryId))
        .returning();

      // Log activity (non-blocking)
      projectIdForQuery(input.queryId).then((projectId) => {
        if (!projectId) return;
        logActivity({
          projectId,
          userId: ctx.user!.id,
          actorName: ctx.user!.email ?? "Unknown",
          eventType: `iq.${input.resolution}`,
          entityType: "interface_query",
          entityId: input.queryId,
          entityLabel: resolvedQuery?.code ?? input.queryId,
          meta: { resolution: input.resolution },
          notificationMessage: `IQ ${resolvedQuery?.code ?? ""} response was ${input.resolution}`,
        }).catch(() => {});
      });

      return { success: true };
    }),
});
