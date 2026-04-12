import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, customAnchorDefinitions } from "@owit/db";
import { eq, and } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import {
  ASSET_ANCHOR_CATALOG,
  FOCUSED_ASSET_TYPES,
  mergeAnchors,
} from "@owit/shared";

const focusedAssetTypeEnum = z.enum(FOCUSED_ASSET_TYPES);

export const anchorCatalogRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const custom = await db.query.customAnchorDefinitions.findMany({
        where: eq(customAnchorDefinitions.projectId, input.projectId),
        orderBy: customAnchorDefinitions.createdAt,
      });
      return mergeAnchors(ASSET_ANCHOR_CATALOG, custom);
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        assetType: focusedAssetTypeEnum,
        key: z.string().min(1).max(50),
        label: z.string().min(1).max(255),
        positionX: z.number(),
        positionY: z.number(),
        positionZ: z.number(),
        normalX: z.number().optional(),
        normalY: z.number().optional(),
        normalZ: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      const [anchor] = await db
        .insert(customAnchorDefinitions)
        .values({
          projectId: input.projectId,
          assetType: input.assetType,
          key: input.key,
          label: input.label,
          positionX: input.positionX,
          positionY: input.positionY,
          positionZ: input.positionZ,
          normalX: input.normalX ?? null,
          normalY: input.normalY ?? null,
          normalZ: input.normalZ ?? null,
        })
        .returning();
      return anchor;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      await db
        .delete(customAnchorDefinitions)
        .where(
          and(
            eq(customAnchorDefinitions.id, input.id),
            eq(customAnchorDefinitions.projectId, input.projectId)
          )
        );
      return { success: true };
    }),
});
