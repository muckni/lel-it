import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, activities, projectMembers } from "@owit/db";
import { eq, desc } from "drizzle-orm";
import { assertMember } from "@/server/lib/rbac";

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
