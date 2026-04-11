import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, assetPlacements } from "@owit/db";
import { eq } from "drizzle-orm";

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
    .query(async ({ input }) => {
      return db.query.assetPlacements.findMany({
        where: eq(assetPlacements.projectId, input.projectId),
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
      })
    )
    .mutation(async ({ input }) => {
      const [placement] = await db
        .insert(assetPlacements)
        .values(input)
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
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const [placement] = await db
        .update(assetPlacements)
        .set(data)
        .where(eq(assetPlacements.id, id))
        .returning();
      return placement;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db
        .delete(assetPlacements)
        .where(eq(assetPlacements.id, input.id));
      return { success: true };
    }),

  // Seed a default layout for a wind farm project
  seedDemo: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // 3x3 grid of turbine+foundation pairs + 1 OSS
      const placements = [];

      // OSS center-left
      placements.push({
        projectId: input.projectId,
        assetType: "oss" as const,
        label: "OSS-01",
        positionX: -30,
        positionY: 2,
        positionZ: 0,
        rotationY: 0,
      });

      // 9 turbines in 3x3 grid
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
