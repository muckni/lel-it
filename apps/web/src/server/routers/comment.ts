import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, comments, lessonsLearned, notifications } from "@owit/db";
import { and, eq } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { assertLessonOwnershipVisible } from "@/server/lib/lesson-visibility";
import { projectIdForComment } from "@/server/lib/project-id";

const parentTypeEnum = z.enum(["interface_point", "interface_query", "lesson_learned"]);

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
      if (input.parentType === "lesson_learned") {
        const lesson = await db.query.lessonsLearned.findFirst({
          where: eq(lessonsLearned.id, input.parentId),
          columns: { ownershipState: true },
        });
        if (!lesson) return [];
        await assertLessonOwnershipVisible(projectId, ctx.user.id, lesson.ownershipState);
      }
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
        mentions: z.array(z.string().uuid()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForComment(input.parentId, input.parentType);
      if (input.parentType === "lesson_learned") {
        await assertMember(ctx.user.id, projectId);
        const lesson = await db.query.lessonsLearned.findFirst({
          where: eq(lessonsLearned.id, input.parentId),
          columns: { ownershipState: true },
        });
        if (!lesson) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
        }
        await assertLessonOwnershipVisible(projectId, ctx.user.id, lesson.ownershipState);
      } else {
        await requireRole(ctx.user.id, projectId, "editor");
      }
      const [comment] = await db
        .insert(comments)
        .values({ ...input, mentions: input.mentions ?? null, authorId: ctx.user.id })
        .returning();

      if (input.parentType === "lesson_learned") {
        const lesson = await db.query.lessonsLearned.findFirst({
          where: eq(lessonsLearned.id, input.parentId),
          columns: { id: true, title: true, authorId: true },
        });
        if (lesson) {
          const recipients = new Set<string>();
          if (lesson.authorId !== ctx.user.id) recipients.add(lesson.authorId);
          for (const mentionId of input.mentions ?? []) {
            if (mentionId !== ctx.user.id) recipients.add(mentionId);
          }

          if (recipients.size > 0) {
            await db.insert(notifications).values(
              Array.from(recipients).map((userId) => ({
                userId,
                type: "lesson_comment",
                referenceType: "lesson_learned",
                referenceId: lesson.id,
                message: `New comment on lesson "${lesson.title}"`,
              }))
            );
          }
        }
      }
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
