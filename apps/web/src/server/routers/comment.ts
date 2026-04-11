import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, comments } from "@owit/db";
import { and, eq, asc } from "drizzle-orm";

export const commentRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        parentType: z.enum(["interface_point", "interface_query"]),
        parentId: z.string().uuid(),
      })
    )
    .query(async ({ input }) => {
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
        parentType: z.enum(["interface_point", "interface_query"]),
        parentId: z.string().uuid(),
        content: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [comment] = await db
        .insert(comments)
        .values({
          ...input,
          authorId: ctx.user!.id,
        })
        .returning();
      return comment;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(comments)
        .where(
          and(eq(comments.id, input.id), eq(comments.authorId, ctx.user!.id))
        );
      return { success: true };
    }),
});
