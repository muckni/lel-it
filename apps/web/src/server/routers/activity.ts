import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, activities, notifications, projectMembers } from "@owit/db";
import { eq, desc, and, inArray } from "drizzle-orm";

export const activityRouter = createTRPCRouter({
  /** Project-level activity feed, newest first */
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      return db.query.activities.findMany({
        where: eq(activities.projectId, input.projectId),
        orderBy: [desc(activities.createdAt)],
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /** Log an activity and optionally create notifications for project members */
  log: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        actorName: z.string(),
        eventType: z.string(),
        entityType: z.string(),
        entityId: z.string().uuid(),
        entityLabel: z.string(),
        meta: z.record(z.string(), z.unknown()).optional(),
        // User IDs to notify (besides the actor)
        notifyUserIds: z.array(z.string().uuid()).optional(),
        notificationMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { notifyUserIds, notificationMessage, ...activityData } = input;

      const [activity] = await db
        .insert(activities)
        .values({
          ...activityData,
          userId: ctx.user!.id,
          meta: activityData.meta ?? null,
        })
        .returning();

      // Create notifications for specified users
      if (notifyUserIds && notifyUserIds.length > 0 && notificationMessage) {
        const toNotify = notifyUserIds.filter((id) => id !== ctx.user!.id);
        if (toNotify.length > 0) {
          await db.insert(notifications).values(
            toNotify.map((userId) => ({
              userId,
              type: input.eventType,
              referenceType: input.entityType,
              referenceId: input.entityId,
              message: notificationMessage,
            }))
          );
        }
      }

      return activity;
    }),

  /** Get all project member user IDs (for notification targeting) */
  projectMemberUserIds: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      const members = await db
        .select({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(eq(projectMembers.projectId, input.projectId));
      return members.map((m) => m.userId);
    }),
});
