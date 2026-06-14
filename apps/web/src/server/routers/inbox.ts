import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, inboxItems, inboxItemAttachments } from "@owit/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

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
        .where(eq(inboxItems.id, item.id));
      return { ok: true as const };
    }),
});
