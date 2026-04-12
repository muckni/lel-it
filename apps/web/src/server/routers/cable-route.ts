import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, cableRoutes, assetPlacements } from "@owit/db";
import { and, eq } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";

export const cableRouteRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.cableRoutes.findMany({
        where: eq(cableRoutes.projectId, input.projectId),
        orderBy: (r, { asc }) => [asc(r.createdAt)],
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        cableType: z.enum(["array_cable", "export_cable"]),
        fromAssetId: z.string().uuid(),
        toAssetId: z.string().uuid(),
        label: z.string().min(1).max(255),
        color: z.string().max(7).optional(),
        waypoints: z.array(z.tuple([z.number(), z.number(), z.number()])).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");

      // Validate that both assets belong to this project
      const projectAssets = await db.query.assetPlacements.findMany({
        where: eq(assetPlacements.projectId, input.projectId),
        columns: { id: true },
      });
      const assetIds = new Set(projectAssets.map((a) => a.id));
      if (!assetIds.has(input.fromAssetId) || !assetIds.has(input.toAssetId)) {
        throw new Error("Assets must belong to this project");
      }

      const [route] = await db
        .insert(cableRoutes)
        .values({
          projectId: input.projectId,
          cableType: input.cableType,
          fromAssetId: input.fromAssetId,
          toAssetId: input.toAssetId,
          label: input.label,
          color: input.color,
          waypoints: input.waypoints,
        })
        .returning();
      return route;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const route = await db.query.cableRoutes.findFirst({
        where: eq(cableRoutes.id, input.id),
        columns: { projectId: true },
      });
      if (!route) {
        throw new Error("Cable route not found");
      }
      await requireRole(ctx.user.id, route.projectId, "editor");
      await db
        .delete(cableRoutes)
        .where(and(eq(cableRoutes.id, input.id), eq(cableRoutes.projectId, route.projectId)));
      return { success: true };
    }),
});
