import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { attachments, db } from "@owit/db";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  hasAllowedAttachmentType,
} from "@/lib/attachments";
import { projectIdForDeliverable, projectIdForIqResponse, projectIdForPoint } from "@/server/lib/project-id";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const BUCKET = "attachments";
const ALLOWED_MIME_TYPES = new Set(ALLOWED_ATTACHMENT_MIME_TYPES);

const entityTypeSchema = z.enum(["interface_point", "deliverable", "iq_response"]);

async function projectIdForAttachmentEntity(
  entityType: z.infer<typeof entityTypeSchema>,
  entityId: string
): Promise<string> {
  if (entityType === "interface_point") return projectIdForPoint(entityId);
  if (entityType === "deliverable") return projectIdForDeliverable(entityId);
  return projectIdForIqResponse(entityId);
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function assertUploadConstraints(
  fileName: string,
  mimeType: string,
  sizeBytes: number
): void {
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "File exceeds 50 MB limit",
    });
  }

  const normalizedMime = mimeType.toLowerCase();
  if (
    normalizedMime.length > 0 &&
    !ALLOWED_MIME_TYPES.has(normalizedMime as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number])
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported file type",
    });
  }

  if (!hasAllowedAttachmentType({ name: fileName, type: mimeType })) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Unsupported file extension",
    });
  }
}

export const attachmentRouter = createTRPCRouter({
  createUploadIntent: protectedProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        entityId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(255).optional().default(""),
        sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertUploadConstraints(input.fileName, input.mimeType, input.sizeBytes);

      const projectId = await projectIdForAttachmentEntity(
        input.entityType,
        input.entityId
      );
      await requireRole(ctx.user.id, projectId, "editor");

      const attachmentId = randomUUID();
      const safeFileName = sanitizeFileName(input.fileName);
      const storagePath = `projects/${projectId}/${input.entityType}/${input.entityId}/${attachmentId}/${safeFileName}`;

      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to create upload URL",
        });
      }

      return {
        attachmentId,
        storagePath,
        signedUploadUrl: data.signedUrl,
        token: data.token,
      };
    }),

  completeUpload: protectedProcedure
    .input(
      z.object({
        attachmentId: z.string().uuid(),
        entityType: entityTypeSchema,
        entityId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        storagePath: z.string().min(1).max(1024),
        mimeType: z.string().max(255).optional().default(""),
        sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertUploadConstraints(input.fileName, input.mimeType, input.sizeBytes);

      const projectId = await projectIdForAttachmentEntity(
        input.entityType,
        input.entityId
      );
      await requireRole(ctx.user.id, projectId, "editor");

      const safeFileName = sanitizeFileName(input.fileName);
      const expectedPrefix = `projects/${projectId}/${input.entityType}/${input.entityId}/${input.attachmentId}/`;
      if (!input.storagePath.startsWith(expectedPrefix)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid storage path",
        });
      }
      if (!input.storagePath.endsWith(safeFileName)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid file name in storage path",
        });
      }

      const [attachment] = await db
        .insert(attachments)
        .values({
          id: input.attachmentId,
          projectId,
          entityType: input.entityType,
          entityId: input.entityId,
          fileName: safeFileName,
          storagePath: input.storagePath,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          uploadedByUserId: ctx.user.id,
        })
        .onConflictDoNothing()
        .returning();

      if (!attachment) {
        const existing = await db.query.attachments.findFirst({
          where: eq(attachments.id, input.attachmentId),
        });
        if (!existing) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to persist attachment metadata",
          });
        }
        return existing;
      }

      return attachment;
    }),

  listByEntity: protectedProcedure
    .input(
      z.object({
        entityType: entityTypeSchema,
        entityId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForAttachmentEntity(
        input.entityType,
        input.entityId
      );
      await assertMember(ctx.user.id, projectId);

      const rows = await db.query.attachments.findMany({
        where: and(
          eq(attachments.entityType, input.entityType),
          eq(attachments.entityId, input.entityId)
        ),
        orderBy: [desc(attachments.createdAt)],
      });

      const uploaderIds = Array.from(new Set(rows.map((row) => row.uploadedByUserId)));
      const uploaderMap = new Map<string, { name: string; email: string }>();

      if (uploaderIds.length > 0) {
        const result = await db.execute(
          sql`SELECT id::text, email, raw_user_meta_data->>'full_name' AS name
              FROM auth.users
              WHERE id = ANY(${uploaderIds}::uuid[])`
        );
        for (const row of result as unknown as Array<{ id: string; email: string | null; name: string | null }>) {
          uploaderMap.set(row.id, {
            email: row.email ?? "",
            name: row.name ?? row.email ?? "Unknown",
          });
        }
      }

      return rows.map((row) => ({
        ...row,
        uploader: uploaderMap.get(row.uploadedByUserId) ?? {
          name: "Unknown",
          email: "",
        },
      }));
    }),

  getDownloadUrl: protectedProcedure
    .input(z.object({ attachmentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const attachment = await db.query.attachments.findFirst({
        where: eq(attachments.id, input.attachmentId),
      });
      if (!attachment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found" });
      }

      await assertMember(ctx.user.id, attachment.projectId);

      const admin = createAdminClient();
      const { data, error } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(attachment.storagePath, 60, { download: attachment.fileName });

      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to create download URL",
        });
      }

      return { url: data.signedUrl };
    }),

  delete: protectedProcedure
    .input(z.object({ attachmentId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const attachment = await db.query.attachments.findFirst({
        where: eq(attachments.id, input.attachmentId),
      });
      if (!attachment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attachment not found" });
      }

      await requireRole(ctx.user.id, attachment.projectId, "editor");

      const admin = createAdminClient();
      const { error } = await admin.storage
        .from(BUCKET)
        .remove([attachment.storagePath]);
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      await db.delete(attachments).where(eq(attachments.id, input.attachmentId));
      return { success: true };
    }),
});
