import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, comments } from "@owit/db";
import { and, eq } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForComment } from "@/server/lib/project-id";

const parentTypeEnum = z.enum(["interface_point", "interface_query"]);

export const commentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        parentType: parentTypeEnum,
        parentId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForComment(input.parentId, input.parentType);
      await assertMember(ctx.user.id, projectId);
      return db.query.comments.findMany({
        where: and(
          eq(comments.parentType, input.parentType),
          eq(comments.parentId, input.parentId)
        ),
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        parentType: parentTypeEnum,
        parentId: z.string().uuid(),
        content: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForComment(input.parentId, input.parentType);
      await requireRole(ctx.user.id, projectId, "editor");
      const [comment] = await db
        .insert(comments)
        .values({ ...input, authorId: ctx.user.id })
        .returning();
      return comment;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Only the author can delete their own comments
      await db
        .delete(comments)
        .where(and(eq(comments.id, input.id), eq(comments.authorId, ctx.user.id)));
      return { success: true };
    }),
});
