import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, assetPlacements } from "@owit/db";
import { and, eq, inArray } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForAssetPlacement } from "@/server/lib/project-id";

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

export const assetPlacementRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.assetPlacements.findMany({
        where: eq(assetPlacements.projectId, input.projectId),
        with: {
          modelRegistryAsset: true,
        },
        orderBy: (a, { asc }) => [asc(a.assetType), asc(a.label)],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        assetType: assetTypeEnum,
        label: z.string().min(1).max(100),
        positionX: z.number().default(0),
        positionY: z.number().default(0),
        positionZ: z.number().default(0),
        rotationY: z.number().default(0),
        modelRegistryAssetId: z.string().uuid().optional(),
        lodLevel: z.number().int().min(0).max(4).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      const [placement] = await db
        .insert(assetPlacements)
        .values({
          ...input,
          modelRegistryAssetId: input.modelRegistryAssetId ?? null,
          lodLevel: input.lodLevel ?? 0,
        })
        .returning();
      return placement;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        label: z.string().min(1).max(100).optional(),
        positionX: z.number().optional(),
        positionY: z.number().optional(),
        positionZ: z.number().optional(),
        rotationY: z.number().optional(),
        modelRegistryAssetId: z.string().uuid().nullable().optional(),
        lodLevel: z.number().int().min(0).max(4).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      const projectId = await projectIdForAssetPlacement(id);
      await requireRole(ctx.user.id, projectId, "editor");
      const [placement] = await db
        .update(assetPlacements)
        .set(data)
        .where(eq(assetPlacements.id, id))
        .returning();
      return placement;
    }),

  setModelReference: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        modelRegistryAssetId: z.string().uuid().nullable(),
        lodLevel: z.number().int().min(0).max(4).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForAssetPlacement(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      const [updated] = await db
        .update(assetPlacements)
        .set({
          modelRegistryAssetId: input.modelRegistryAssetId,
          lodLevel: input.lodLevel ?? 0,
        })
        .where(eq(assetPlacements.id, input.id))
        .returning();
      return updated;
    }),

  bulkUpsert: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        placements: z.array(
          z.object({
            id: z.string().uuid().optional(),
            assetType: assetTypeEnum,
            label: z.string().min(1).max(100),
            positionX: z.number(),
            positionY: z.number(),
            positionZ: z.number(),
            rotationY: z.number().optional().default(0),
            modelRegistryAssetId: z.string().uuid().optional(),
            lodLevel: z.number().int().min(0).max(4).optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");

      const updatedIds: string[] = [];
      const createdIds: string[] = [];
      for (const row of input.placements) {
        if (row.id) {
          // eslint-disable-next-line no-await-in-loop
          const [updated] = await db
            .update(assetPlacements)
            .set({
              assetType: row.assetType,
              label: row.label,
              positionX: row.positionX,
              positionY: row.positionY,
              positionZ: row.positionZ,
              rotationY: row.rotationY ?? 0,
              modelRegistryAssetId: row.modelRegistryAssetId ?? null,
              lodLevel: row.lodLevel ?? 0,
            })
            .where(and(eq(assetPlacements.id, row.id), eq(assetPlacements.projectId, input.projectId)))
            .returning({ id: assetPlacements.id });
          if (updated) updatedIds.push(updated.id);
          continue;
        }

        // eslint-disable-next-line no-await-in-loop
        const [created] = await db
          .insert(assetPlacements)
          .values({
            projectId: input.projectId,
            assetType: row.assetType,
            label: row.label,
            positionX: row.positionX,
            positionY: row.positionY,
            positionZ: row.positionZ,
            rotationY: row.rotationY ?? 0,
            modelRegistryAssetId: row.modelRegistryAssetId ?? null,
            lodLevel: row.lodLevel ?? 0,
          })
          .returning({ id: assetPlacements.id });
        createdIds.push(created.id);
      }

      return { created: createdIds.length, updated: updatedIds.length };
    }),

  focusBounds: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        ids: z.array(z.string().uuid()).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const where = input.ids && input.ids.length > 0
        ? and(eq(assetPlacements.projectId, input.projectId), inArray(assetPlacements.id, input.ids))
        : eq(assetPlacements.projectId, input.projectId);

      const rows = await db.query.assetPlacements.findMany({
        where,
        columns: {
          id: true,
          positionX: true,
          positionY: true,
          positionZ: true,
        },
      });

      if (rows.length === 0) {
        return null;
      }

      const xs = rows.map((r) => r.positionX);
      const ys = rows.map((r) => r.positionY);
      const zs = rows.map((r) => r.positionZ);

      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs),
      };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForAssetPlacement(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      await db.delete(assetPlacements).where(eq(assetPlacements.id, input.id));
      return { success: true };
    }),

  exportLayout: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.projectId);
      const placements = await db.query.assetPlacements.findMany({
        where: eq(assetPlacements.projectId, input.projectId),
      });
      return placements.map((p) => ({
        label: p.label,
        assetType: p.assetType,
        positionX: p.positionX,
        positionY: p.positionY,
        positionZ: p.positionZ,
        rotationY: p.rotationY,
      }));
    }),

  importLayout: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        placements: z.array(
          z.object({
            label: z.string().min(1),
            assetType: assetTypeEnum,
            positionX: z.number(),
            positionY: z.number(),
            positionZ: z.number(),
            rotationY: z.number().optional().default(0),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      await db.delete(assetPlacements).where(eq(assetPlacements.projectId, input.projectId));
      if (input.placements.length > 0) {
        await db.insert(assetPlacements).values(
          input.placements.map((p) => ({ ...p, projectId: input.projectId }))
        );
      }
      return { count: input.placements.length };
    }),

  seedDemo: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");

      const placements = [];
      placements.push({
        projectId: input.projectId,
        assetType: "oss" as const,
        label: "OSS-01",
        positionX: -30,
        positionY: 2,
        positionZ: 0,
        rotationY: 0,
      });

      let t = 1;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const x = col * 20;
          const z = row * 20 - 20;
          placements.push({
            projectId: input.projectId,
            assetType: "turbine" as const,
            label: `WTG-${String(t).padStart(2, "0")}`,
            positionX: x,
            positionY: 9,
            positionZ: z,
            rotationY: 0,
          });
          placements.push({
            projectId: input.projectId,
            assetType: "foundation" as const,
            label: `FND-${String(t).padStart(2, "0")}`,
            positionX: x,
            positionY: 0,
            positionZ: z,
            rotationY: 0,
          });
          t++;
        }
      }

      await db.insert(assetPlacements).values(placements);
      return { count: placements.length };
    }),
});
