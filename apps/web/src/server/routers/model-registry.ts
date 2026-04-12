import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { assetPlacements, db, modelRegistryAssets } from "@owit/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const BUCKET = "attachments";
const MODEL_MIME_TYPES = [
  "model/gltf+json",
  "model/gltf-binary",
  "application/octet-stream",
] as const;

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function assertModelFile(fileName: string, mimeType: string) {
  const lower = fileName.toLowerCase();
  const validExt = lower.endsWith(".glb") || lower.endsWith(".gltf");
  const validMime =
    MODEL_MIME_TYPES.includes(mimeType as (typeof MODEL_MIME_TYPES)[number]) ||
    mimeType === "";
  if (!validExt || !validMime) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only GLB/GLTF files are supported",
    });
  }
}

const assetTypeEnum = z.enum([
  "turbine",
  "foundation",
  "oss",
  "onshore_substation",
  "array_cable",
  "export_cable",
  "met_mast",
  "other",
]);

export const modelRegistryRouter = createTRPCRouter({
  createUploadIntent: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        assetType: assetTypeEnum,
        semanticTag: z.string().max(64).optional(),
        versionLabel: z.string().max(64).optional(),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(255).optional().default(""),
        sizeBytes: z.number().int().positive().max(250 * 1024 * 1024),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      assertModelFile(input.fileName, input.mimeType);

      const modelId = randomUUID();
      const safeFileName = sanitizeFileName(input.fileName);
      const storagePath = `projects/${input.projectId}/3d-models/${input.assetType}/${modelId}/${safeFileName}`;

      const admin = createAdminClient();
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath);
      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error?.message ?? "Failed to create upload URL",
        });
      }

      return {
        modelId,
        storagePath,
        signedUploadUrl: data.signedUrl,
        token: data.token,
      };
    }),

  completeUpload: protectedProcedure
    .input(
      z.object({
        modelId: z.string().uuid(),
        projectId: z.string().uuid(),
        assetType: assetTypeEnum,
        semanticTag: z.string().max(64).optional(),
        versionLabel: z.string().max(64).optional(),
        fileName: z.string().min(1).max(255),
        storagePath: z.string().min(1).max(1024),
        mimeType: z.string().max(255).optional().default("application/octet-stream"),
        sizeBytes: z.number().int().positive().max(250 * 1024 * 1024),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      assertModelFile(input.fileName, input.mimeType);

      const safeFileName = sanitizeFileName(input.fileName);
      const expectedPrefix = `projects/${input.projectId}/3d-models/${input.assetType}/${input.modelId}/`;
      if (!input.storagePath.startsWith(expectedPrefix)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid storage path" });
      }
      if (!input.storagePath.endsWith(safeFileName)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid file name in storage path" });
      }

      // Verify the uploaded object's content type from storage (server-side)
      const admin = createAdminClient();
      const { data: objectInfo } = await admin.storage.from(BUCKET).info(input.storagePath);
      if (objectInfo?.contentType) {
        const ct = objectInfo.contentType.toLowerCase();
        const validStorageMimes = ["model/gltf-binary", "model/gltf+json"];
        // application/octet-stream is also accepted (some upload clients set this for .glb)
        const isValidStorageMime =
          validStorageMimes.some((mime) => ct.startsWith(mime)) ||
          ct.startsWith("application/octet-stream");
        if (!isValidStorageMime) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Rejected: storage content-type "${objectInfo.contentType}" is not a valid GLTF type`,
          });
        }
      }

      const [created] = await db
        .insert(modelRegistryAssets)
        .values({
          id: input.modelId,
          projectId: input.projectId,
          assetType: input.assetType,
          semanticTag: input.semanticTag ?? null,
          versionLabel: input.versionLabel ?? "v1",
          fileName: safeFileName,
          storagePath: input.storagePath,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          uploadedByUserId: ctx.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();

      if (!created) {
        const existing = await db.query.modelRegistryAssets.findFirst({
          where: eq(modelRegistryAssets.id, input.modelId),
        });
        if (!existing) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to persist model metadata",
          });
        }
        return existing;
      }

      return created;
    }),

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        assetType: assetTypeEnum.optional(),
        includeSignedUrls: z.boolean().optional().default(false),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const where = input.assetType
        ? and(
            eq(modelRegistryAssets.projectId, input.projectId),
            eq(modelRegistryAssets.assetType, input.assetType)
          )
        : eq(modelRegistryAssets.projectId, input.projectId);

      const rows = await db.query.modelRegistryAssets.findMany({
        where,
        orderBy: [desc(modelRegistryAssets.createdAt)],
      });

      if (!input.includeSignedUrls || rows.length === 0) {
        return rows.map((row) => ({ ...row, signedUrl: null as string | null }));
      }

      const admin = createAdminClient();
      const withUrls = await Promise.all(
        rows.map(async (row) => {
          const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(row.storagePath, 120);
          if (error || !data) return { ...row, signedUrl: null as string | null };
          return { ...row, signedUrl: data.signedUrl };
        })
      );

      return withUrls;
    }),

  setActiveVersion: protectedProcedure
    .input(z.object({ modelId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const model = await db.query.modelRegistryAssets.findFirst({
        where: eq(modelRegistryAssets.id, input.modelId),
      });
      if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });

      await requireRole(ctx.user.id, model.projectId, "editor");

      const semanticTagFilter =
        model.semanticTag === null
          ? isNull(modelRegistryAssets.semanticTag)
          : eq(modelRegistryAssets.semanticTag, model.semanticTag);

      await db
        .update(modelRegistryAssets)
        .set({ isActiveVersion: false, updatedAt: new Date() })
        .where(
          and(
            eq(modelRegistryAssets.projectId, model.projectId),
            eq(modelRegistryAssets.assetType, model.assetType),
            semanticTagFilter
          )
        );

      const [updated] = await db
        .update(modelRegistryAssets)
        .set({ isActiveVersion: true, updatedAt: new Date() })
        .where(eq(modelRegistryAssets.id, model.id))
        .returning();

      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ modelId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const model = await db.query.modelRegistryAssets.findFirst({
        where: eq(modelRegistryAssets.id, input.modelId),
      });
      if (!model) throw new TRPCError({ code: "NOT_FOUND", message: "Model not found" });

      await requireRole(ctx.user.id, model.projectId, "editor");

      const inUse = await db.query.assetPlacements.findFirst({
        where: eq(assetPlacements.modelRegistryAssetId, model.id),
        columns: { id: true },
      });
      if (inUse) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Model is currently referenced by placed assets",
        });
      }

      const admin = createAdminClient();
      const { error } = await admin.storage.from(BUCKET).remove([model.storagePath]);
      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      await db.delete(modelRegistryAssets).where(eq(modelRegistryAssets.id, model.id));
      return { success: true };
    }),
});
