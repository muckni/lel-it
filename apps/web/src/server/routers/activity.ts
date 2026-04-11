import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, activities, notifications, projectMembers } from "@owit/db";
import { eq, desc } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";

// Whitelist of valid event types clients may log
const CLIENT_EVENT_TYPES = [
  "interface_point.created",
  "interface_point.updated",
  "iq.raised",
  "iq.responded",
  "iq.accepted",
  "iq.rejected",
  "deliverable.status_changed",
] as const;

export const activityRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.activities.findMany({
        where: eq(activities.projectId, input.projectId),
        orderBy: [desc(activities.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Client-callable log endpoint.
   * Actor identity is always derived from the session — never trusted from input.
   * eventType must be in the whitelist.
   */
  log: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        eventType: z.enum(CLIENT_EVENT_TYPES),
        entityType: z.string().min(1).max(100),
        entityId: z.string().uuid(),
        entityLabel: z.string().min(0).max(500),
        meta: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");

      const [activity] = await db
        .insert(activities)
        .values({
          projectId: input.projectId,
          userId: ctx.user.id,
          actorName: ctx.user.email ?? "Unknown", // always server-derived
          eventType: input.eventType,
          entityType: input.entityType,
          entityId: input.entityId,
          entityLabel: input.entityLabel,
          meta: input.meta ?? null,
        })
        .returning();

      return activity;
    }),

  projectMemberUserIds: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const members = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.projectId));
      return members.map((m) => m.userId);
    }),
});
