import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  inboxItems,
  lessonsV2,
  lessonCategories,
  lessonAuditLog,
  attachments,
} from "@owit/db";
import { LESSON_TYPES } from "@owit/shared";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENT_BUCKET, sanitizeAttachmentFileName } from "@/lib/attachments";
import { requireV2ProjectCapability } from "@/server/lib/lesson-v2-rbac";
import { buildLessonV2AuditEvent } from "@/server/lib/lesson-v2-transfer";
import { textToTiptapDoc } from "@/server/lib/inbox-content";

async function getOwnedItem(inboxItemId: string, userId: string) {
  const item = await db.query.inboxItems.findFirst({
    where: and(eq(inboxItems.id, inboxItemId), eq(inboxItems.userId, userId)),
    with: { attachments: true },
  });
  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Inbox item not found" });
  }
  return item;
}

async function assertCategoryExists(categoryId: string) {
  const category = await db.query.lessonCategories.findFirst({
    where: and(eq(lessonCategories.id, categoryId), eq(lessonCategories.active, true)),
    columns: { id: true },
  });
  if (!category) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Category does not exist" });
  }
}

export const inboxRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await db.query.inboxItems.findMany({
      where: and(
        eq(inboxItems.userId, ctx.user.id),
        eq(inboxItems.status, "new")
      ),
      orderBy: [desc(inboxItems.receivedAt)],
      with: { attachments: { columns: { id: true } } },
    });

    return {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        fromEmail: item.fromEmail,
        fromName: item.fromName,
        subject: item.subject,
        snippet: item.textBody.replace(/\s+/g, " ").trim().slice(0, 200),
        receivedAt: item.receivedAt,
        attachmentCount: item.attachments.length,
      })),
    };
  }),

  get: protectedProcedure
    .input(z.object({ inboxItemId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const item = await getOwnedItem(input.inboxItemId, ctx.user.id);
      return {
        id: item.id,
        status: item.status,
        fromEmail: item.fromEmail,
        fromName: item.fromName,
        subject: item.subject,
        textBody: item.textBody,
        receivedAt: item.receivedAt,
        lessonId: item.lessonId,
        attachments: item.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
      };
    }),

  discard: protectedProcedure
    .input(z.object({ inboxItemId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const item = await getOwnedItem(input.inboxItemId, ctx.user.id);
      if (item.status !== "new") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only new inbox items can be discarded",
        });
      }
      await db
        .update(inboxItems)
        .set({ status: "discarded" })
        .where(and(eq(inboxItems.id, item.id), eq(inboxItems.userId, ctx.user.id)));
      return { ok: true as const };
    }),

  assignToProject: protectedProcedure
    .input(
      z.object({
        inboxItemId: z.string().uuid(),
        projectId: z.string().uuid(),
        categoryId: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        type: z.enum(LESSON_TYPES).default("problem"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await getOwnedItem(input.inboxItemId, ctx.user.id);
      if (item.status !== "new") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Inbox item already handled",
        });
      }
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "create_lesson");
      await assertCategoryExists(input.categoryId);

      const lessonId = randomUUID();
      const title = input.title ?? (item.subject.trim() || "(no subject)");
      const description = item.textBody.trim() || "(no body)";
      const content = textToTiptapDoc(item.textBody);

      // Copy staged attachments into the project's lesson path FIRST; a failure
      // here throws before any DB write so the item is never half-converted.
      // (A transaction failure AFTER a successful copy leaves an orphaned storage
      // object — acceptable for v1; TODO: GC storage paths with no attachments row.)
      const admin = createAdminClient();
      const attachmentRows: (typeof attachments.$inferInsert)[] = [];
      for (const att of item.attachments) {
        const attachmentId = randomUUID();
        const safeName = sanitizeAttachmentFileName(att.fileName);
        const destPath = `projects/${input.projectId}/lesson/${lessonId}/${attachmentId}/${safeName}`;
        const { error } = await admin.storage
          .from(ATTACHMENT_BUCKET)
          .copy(att.storagePath, destPath);
        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to copy attachment ${att.fileName}: ${error.message}`,
          });
        }
        attachmentRows.push({
          id: attachmentId,
          projectId: input.projectId,
          entityType: "lesson",
          entityId: lessonId,
          fileName: safeName,
          storagePath: destPath,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          uploadedByUserId: ctx.user.id,
        });
      }

      await db.transaction(async (tx) => {
        await tx.insert(lessonsV2).values({
          id: lessonId,
          projectId: input.projectId,
          title,
          description,
          content: content as Record<string, unknown>,
          type: input.type,
          categoryId: input.categoryId,
          authorId: ctx.user.id,
          status: "draft",
        });
        if (attachmentRows.length > 0) {
          await tx.insert(attachments).values(attachmentRows);
        }
        // Claim the item only if it is still 'new'. Under a concurrent double
        // submit, the second transaction updates 0 rows here and throws, rolling
        // back its just-inserted lesson — so only one draft lesson is ever created.
        const claimed = await tx
          .update(inboxItems)
          .set({ status: "assigned", lessonId })
          .where(
            and(
              eq(inboxItems.id, item.id),
              eq(inboxItems.userId, ctx.user.id),
              eq(inboxItems.status, "new")
            )
          )
          .returning({ id: inboxItems.id });
        if (claimed.length === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Inbox item already handled",
          });
        }
        await tx.insert(lessonAuditLog).values(
          buildLessonV2AuditEvent({
            entityType: "lesson",
            entityId: lessonId,
            eventType: "created",
            actorId: ctx.user.id,
            projectId: input.projectId,
            newValue: { source: "inbox", inboxItemId: item.id },
          }) as typeof lessonAuditLog.$inferInsert
        );
      });

      return { lessonId, projectId: input.projectId };
    }),
});
