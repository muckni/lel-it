import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  db,
  interfacePoints,
  interfaceAgreements,
  interfaceRegisters,
  interfaceQueries,
  deliverables,
  workPackages,
} from "@owit/db";
import { eq, inArray, sql, and } from "drizzle-orm";

export const reportRouter = createTRPCRouter({
  projectSummary: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { projectId } = input;

      // Get all registers for project
      const registers = await db
        .select({ id: interfaceRegisters.id, packageAId: interfaceRegisters.packageAId, packageBId: interfaceRegisters.packageBId })
        .from(interfaceRegisters)
        .where(eq(interfaceRegisters.projectId, projectId));

      if (registers.length === 0) {
        return {
          pointsByStatus: [],
          pointsByCriticality: [],
          iqsByStatus: [],
          deliverablesByStatus: [],
          packagePairMatrix: [],
          totals: { points: 0, iqs: 0, deliverables: 0, openIqs: 0 },
        };
      }

      const registerIds = registers.map((r) => r.id);

      // Get agreement IDs
      const agreements = await db
        .select({ id: interfaceAgreements.id })
        .from(interfaceAgreements)
        .where(inArray(interfaceAgreements.registerId, registerIds));

      const agreementIds = agreements.map((a) => a.id);

      if (agreementIds.length === 0) {
        return {
          pointsByStatus: [],
          pointsByCriticality: [],
          iqsByStatus: [],
          deliverablesByStatus: [],
          packagePairMatrix: [],
          totals: { points: 0, iqs: 0, deliverables: 0, openIqs: 0 },
        };
      }

      // Points by status
      const pointsByStatusRaw = await db
        .select({
          status: interfacePoints.status,
          count: sql<number>`count(*)::int`,
        })
        .from(interfacePoints)
        .where(inArray(interfacePoints.agreementId, agreementIds))
        .groupBy(interfacePoints.status);

      // Points by criticality
      const pointsByCriticalityRaw = await db
        .select({
          criticality: interfacePoints.criticality,
          count: sql<number>`count(*)::int`,
        })
        .from(interfacePoints)
        .where(inArray(interfacePoints.agreementId, agreementIds))
        .groupBy(interfacePoints.criticality);

      // Get all point IDs for IQ + deliverable queries
      const points = await db
        .select({ id: interfacePoints.id })
        .from(interfacePoints)
        .where(inArray(interfacePoints.agreementId, agreementIds));

      const pointIds = points.map((p) => p.id);

      // IQs by status
      const iqsByStatusRaw =
        pointIds.length > 0
          ? await db
              .select({
                status: interfaceQueries.status,
                count: sql<number>`count(*)::int`,
              })
              .from(interfaceQueries)
              .where(inArray(interfaceQueries.interfacePointId, pointIds))
              .groupBy(interfaceQueries.status)
          : [];

      // Deliverables by status
      const deliverablesByStatusRaw =
        pointIds.length > 0
          ? await db
              .select({
                status: deliverables.status,
                count: sql<number>`count(*)::int`,
              })
              .from(deliverables)
              .where(inArray(deliverables.interfacePointId, pointIds))
              .groupBy(deliverables.status)
          : [];

      // Package pair matrix — count points per register pair
      const packages = await db
        .select({ id: workPackages.id, code: workPackages.code, color: workPackages.color })
        .from(workPackages)
        .where(eq(workPackages.projectId, projectId));

      const pkgMap = new Map(packages.map((p) => [p.id, p]));

      // Count interface points per register (via agreements)
      const pointCountPerRegister = await db
        .select({
          registerId: interfaceAgreements.registerId,
          count: sql<number>`count(*)::int`,
        })
        .from(interfacePoints)
        .innerJoin(interfaceAgreements, eq(interfacePoints.agreementId, interfaceAgreements.id))
        .where(inArray(interfaceAgreements.registerId, registerIds))
        .groupBy(interfaceAgreements.registerId);

      const countByRegister = new Map(pointCountPerRegister.map((r) => [r.registerId, r.count]));

      const packagePairMatrix = registers.map((reg) => ({
        packageA: pkgMap.get(reg.packageAId) ?? { code: "?", color: "#888" },
        packageB: pkgMap.get(reg.packageBId) ?? { code: "?", color: "#888" },
        count: countByRegister.get(reg.id) ?? 0,
      }));

      // Totals
      const totalPoints = pointsByStatusRaw.reduce((s, r) => s + r.count, 0);
      const totalIqs = iqsByStatusRaw.reduce((s, r) => s + r.count, 0);
      const totalDeliverables = deliverablesByStatusRaw.reduce((s, r) => s + r.count, 0);
      const openIqs = iqsByStatusRaw
        .filter((r) => r.status === "open" || r.status === "responded")
        .reduce((s, r) => s + r.count, 0);

      return {
        pointsByStatus: pointsByStatusRaw,
        pointsByCriticality: pointsByCriticalityRaw,
        iqsByStatus: iqsByStatusRaw,
        deliverablesByStatus: deliverablesByStatusRaw,
        packagePairMatrix,
        totals: {
          points: totalPoints,
          iqs: totalIqs,
          deliverables: totalDeliverables,
          openIqs,
        },
      };
    }),
});
