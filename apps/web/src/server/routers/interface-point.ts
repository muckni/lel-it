import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  db,
  interfacePoints,
  interfaceAgreements,
  interfaceRegisters,
  customAnchorDefinitions,
} from "@owit/db";
import { eq, sql, and, inArray } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForAgreement, projectIdForPoint } from "@/server/lib/project-id";
import {
  FOCUSED_ASSET_TYPES,
  isValidAnchorForAssetType,
} from "@owit/shared";

const phaseEnum = z.enum([
  "maturation",
  "feed",
  "detailed_design",
  "procurement",
  "fabrication",
  "installation",
  "commissioning",
  "operations",
]);

const scopeValueSchema = z
  .union([z.string().uuid(), z.literal("n.r."), z.literal("multiple"), z.null()])
  .optional();

const scopeAllocationInputSchema = z.object({
  scopeSpec: scopeValueSchema,
  scopeDes: scopeValueSchema,
  scopeSup: scopeValueSchema,
  scopeOnA: scopeValueSchema,
  scopeOnT: scopeValueSchema,
  scopeOnC: scopeValueSchema,
  scopeOffT: scopeValueSchema,
  scopeOffI: scopeValueSchema,
  scopeOffC: scopeValueSchema,
});

const focusedAssetTypeEnum = z.enum(FOCUSED_ASSET_TYPES);

type ScopeValueInput = z.infer<typeof scopeValueSchema>;

function normalizeScopeValue(value: ScopeValueInput) {
  if (value === "multiple") {
    return { packageId: null as string | null, mode: "multiple" as const };
  }
  if (value === "n.r." || value === null || value === undefined) {
    return { packageId: null as string | null, mode: "not_relevant" as const };
  }
  return { packageId: value, mode: "package" as const };
}

function normalizeScopeValueForUpdate(value: ScopeValueInput) {
  if (value === undefined) return undefined;
  return normalizeScopeValue(value);
}

function normalizeDateForCreate(value: string | undefined): string | null {
  if (!value) return null;
  return value;
}

function normalizeDateForUpdate(
  value: string | undefined
): string | null | undefined {
  if (value === undefined) return undefined;
  if (!value) return null;
  return value;
}

export const interfacePointRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ agreementId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForAgreement(input.agreementId);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfacePoints.findMany({
        where: eq(interfacePoints.agreementId, input.agreementId),
        with: { deliverables: true, queries: true },
        orderBy: interfacePoints.code,
      });
    }),

  listByProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
        criticality: z.enum(["critical", "major", "minor"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const registers = await db.query.interfaceRegisters.findMany({
        where: eq(interfaceRegisters.projectId, input.projectId),
        columns: { id: true },
      });
      if (registers.length === 0) return [];

      const agreements = await db.query.interfaceAgreements.findMany({
        where: inArray(interfaceAgreements.registerId, registers.map((r) => r.id)),
        columns: { id: true },
      });
      if (agreements.length === 0) return [];

      const agreementIds = agreements.map((a) => a.id);
      const conditions = [inArray(interfacePoints.agreementId, agreementIds)];
      if (input.status) conditions.push(eq(interfacePoints.status, input.status));
      if (input.criticality) conditions.push(eq(interfacePoints.criticality, input.criticality));

      return db.query.interfacePoints.findMany({
        where: and(...conditions),
        with: {
          agreement: {
            with: { register: { with: { packageA: true, packageB: true } } },
          },
          deliverables: true,
          queries: true,
        },
        orderBy: interfacePoints.code,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForPoint(input.id);
      await assertMember(ctx.user.id, projectId);
      return db.query.interfacePoints.findFirst({
        where: eq(interfacePoints.id, input.id),
        with: {
          agreement: {
            with: { register: { with: { packageA: true, packageB: true } } },
          },
          deliverables: true,
          queries: { with: { responses: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        agreementId: z.string().uuid(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        criticality: z.enum(["critical", "major", "minor"]).default("minor"),
        phase: phaseEnum.optional(),
        dueDate: z.string().optional(),
      }).merge(scopeAllocationInputSchema)
    )
    .mutation(async ({ input, ctx }) => {
      const {
        scopeSpec: inputScopeSpec,
        scopeDes: inputScopeDes,
        scopeSup: inputScopeSup,
        scopeOnA: inputScopeOnA,
        scopeOnT: inputScopeOnT,
        scopeOnC: inputScopeOnC,
        scopeOffT: inputScopeOffT,
        scopeOffI: inputScopeOffI,
        scopeOffC: inputScopeOffC,
        ...baseInput
      } = input;
      const projectId = await projectIdForAgreement(input.agreementId);
      await requireRole(ctx.user.id, projectId, "editor");

      const agreement = await db.query.interfaceAgreements.findFirst({
        where: eq(interfaceAgreements.id, input.agreementId),
        with: {
          register: {
            columns: {
              packageAId: true,
              packageBId: true,
            },
          },
        },
      });
      if (!agreement) throw new Error("Agreement not found");

      const allowedPackageIds = new Set([
        agreement.register.packageAId,
        agreement.register.packageBId,
      ]);

      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(interfacePoints)
        .where(eq(interfacePoints.agreementId, input.agreementId));
      const nextNum = Number(existing[0].count) + 1;
      const code = `${agreement.code.replace("IA", "IP")}-${String(nextNum).padStart(3, "0")}`;

      const scopeSpec = normalizeScopeValue(inputScopeSpec);
      const scopeDes = normalizeScopeValue(inputScopeDes);
      const scopeSup = normalizeScopeValue(inputScopeSup);
      const scopeOnA = normalizeScopeValue(inputScopeOnA);
      const scopeOnT = normalizeScopeValue(inputScopeOnT);
      const scopeOnC = normalizeScopeValue(inputScopeOnC);
      const scopeOffT = normalizeScopeValue(inputScopeOffT);
      const scopeOffI = normalizeScopeValue(inputScopeOffI);
      const scopeOffC = normalizeScopeValue(inputScopeOffC);

      const selectedPackageIds = [
        scopeSpec.packageId,
        scopeDes.packageId,
        scopeSup.packageId,
        scopeOnA.packageId,
        scopeOnT.packageId,
        scopeOnC.packageId,
        scopeOffT.packageId,
        scopeOffI.packageId,
        scopeOffC.packageId,
      ].filter((value): value is string => !!value);

      if (!selectedPackageIds.every((value) => allowedPackageIds.has(value))) {
        throw new Error("Scope allocation must reference one of the agreement work packages");
      }

      const [point] = await db
        .insert(interfacePoints)
        .values({
          ...baseInput,
          code,
          dueDate: normalizeDateForCreate(baseInput.dueDate),
          description: baseInput.description || null,
          scopeSpecPackageId: scopeSpec.packageId,
          scopeSpecMode: scopeSpec.mode,
          scopeDesPackageId: scopeDes.packageId,
          scopeDesMode: scopeDes.mode,
          scopeSupPackageId: scopeSup.packageId,
          scopeSupMode: scopeSup.mode,
          scopeOnAPackageId: scopeOnA.packageId,
          scopeOnAMode: scopeOnA.mode,
          scopeOnTPackageId: scopeOnT.packageId,
          scopeOnTMode: scopeOnT.mode,
          scopeOnCPackageId: scopeOnC.packageId,
          scopeOnCMode: scopeOnC.mode,
          scopeOffTPackageId: scopeOffT.packageId,
          scopeOffTMode: scopeOffT.mode,
          scopeOffIPackageId: scopeOffI.packageId,
          scopeOffIMode: scopeOffI.mode,
          scopeOffCPackageId: scopeOffC.packageId,
          scopeOffCMode: scopeOffC.mode,
        })
        .returning();
      return point;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        criticality: z.enum(["critical", "major", "minor"]).optional(),
        status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
        phase: phaseEnum.optional(),
        dueDate: z.string().optional(),
      }).merge(scopeAllocationInputSchema)
    )
    .mutation(async ({ input, ctx }) => {
      const {
        id,
        scopeSpec: inputScopeSpec,
        scopeDes: inputScopeDes,
        scopeSup: inputScopeSup,
        scopeOnA: inputScopeOnA,
        scopeOnT: inputScopeOnT,
        scopeOnC: inputScopeOnC,
        scopeOffT: inputScopeOffT,
        scopeOffI: inputScopeOffI,
        scopeOffC: inputScopeOffC,
        ...data
      } = input;
      const projectId = await projectIdForPoint(id);
      await requireRole(ctx.user.id, projectId, "editor");

      const existingPoint = await db.query.interfacePoints.findFirst({
        where: eq(interfacePoints.id, id),
        with: {
          agreement: {
            with: {
              register: {
                columns: {
                  packageAId: true,
                  packageBId: true,
                },
              },
            },
          },
        },
      });
      if (!existingPoint) throw new Error("Interface point not found");

      const allowedPackageIds = new Set([
        existingPoint.agreement.register.packageAId,
        existingPoint.agreement.register.packageBId,
      ]);

      const scopeSpec = normalizeScopeValueForUpdate(inputScopeSpec);
      const scopeDes = normalizeScopeValueForUpdate(inputScopeDes);
      const scopeSup = normalizeScopeValueForUpdate(inputScopeSup);
      const scopeOnA = normalizeScopeValueForUpdate(inputScopeOnA);
      const scopeOnT = normalizeScopeValueForUpdate(inputScopeOnT);
      const scopeOnC = normalizeScopeValueForUpdate(inputScopeOnC);
      const scopeOffT = normalizeScopeValueForUpdate(inputScopeOffT);
      const scopeOffI = normalizeScopeValueForUpdate(inputScopeOffI);
      const scopeOffC = normalizeScopeValueForUpdate(inputScopeOffC);

      const selectedPackageIds = [
        scopeSpec?.packageId,
        scopeDes?.packageId,
        scopeSup?.packageId,
        scopeOnA?.packageId,
        scopeOnT?.packageId,
        scopeOnC?.packageId,
        scopeOffT?.packageId,
        scopeOffI?.packageId,
        scopeOffC?.packageId,
      ].filter((value): value is string => !!value);

      if (!selectedPackageIds.every((value) => allowedPackageIds.has(value))) {
        throw new Error("Scope allocation must reference one of the agreement work packages");
      }

      const dueDate = normalizeDateForUpdate(data.dueDate);
      const [point] = await db
        .update(interfacePoints)
        .set({
          ...data,
          dueDate,
          description:
            data.description === undefined ? undefined : data.description || null,
          scopeSpecPackageId: scopeSpec?.packageId,
          scopeSpecMode: scopeSpec?.mode,
          scopeDesPackageId: scopeDes?.packageId,
          scopeDesMode: scopeDes?.mode,
          scopeSupPackageId: scopeSup?.packageId,
          scopeSupMode: scopeSup?.mode,
          scopeOnAPackageId: scopeOnA?.packageId,
          scopeOnAMode: scopeOnA?.mode,
          scopeOnTPackageId: scopeOnT?.packageId,
          scopeOnTMode: scopeOnT?.mode,
          scopeOnCPackageId: scopeOnC?.packageId,
          scopeOnCMode: scopeOnC?.mode,
          scopeOffTPackageId: scopeOffT?.packageId,
          scopeOffTMode: scopeOffT?.mode,
          scopeOffIPackageId: scopeOffI?.packageId,
          scopeOffIMode: scopeOffI?.mode,
          scopeOffCPackageId: scopeOffC?.packageId,
          scopeOffCMode: scopeOffC?.mode,
          updatedAt: new Date(),
        })
        .where(eq(interfacePoints.id, id))
        .returning();
      return point;
    }),

  set3dAnchor: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        assetType: focusedAssetTypeEnum,
        anchorKey: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForPoint(input.id);
      await requireRole(ctx.user.id, projectId, "editor");

      const isDefaultValid = isValidAnchorForAssetType(input.assetType, input.anchorKey);
      if (!isDefaultValid) {
        // Check custom anchors for this project + assetType
        const customAnchors = await db.query.customAnchorDefinitions.findMany({
          where: and(
            eq(customAnchorDefinitions.projectId, projectId),
            eq(customAnchorDefinitions.assetType, input.assetType)
          ),
          columns: { key: true },
        });
        const isCustomValid = customAnchors.some((a) => a.key === input.anchorKey);
        if (!isCustomValid) {
          throw new Error("Invalid anchor for selected asset type");
        }
      }

      const [point] = await db
        .update(interfacePoints)
        .set({
          assetType: input.assetType,
          assetPositionRef: input.anchorKey,
          spatialX: null,
          spatialY: null,
          spatialZ: null,
          updatedAt: new Date(),
        })
        .where(eq(interfacePoints.id, input.id))
        .returning();

      return point;
    }),

  clear3dAnchor: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForPoint(input.id);
      await requireRole(ctx.user.id, projectId, "editor");

      const [point] = await db
        .update(interfacePoints)
        .set({
          assetType: null,
          assetPositionRef: null,
          updatedAt: new Date(),
        })
        .where(eq(interfacePoints.id, input.id))
        .returning();

      return point;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForPoint(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      await db.delete(interfacePoints).where(eq(interfacePoints.id, input.id));
      return { success: true };
    }),

  bulkCreate: protectedProcedure
    .input(
      z.object({
        agreementId: z.string().uuid(),
        rows: z.array(
          z.object({
            title: z.string().min(1).max(255),
            description: z.string().optional(),
            criticality: z.enum(["critical", "major", "minor"]).optional(),
            phase: phaseEnum.optional(),
            dueDate: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForAgreement(input.agreementId);
      await requireRole(ctx.user.id, projectId, "editor");

      const agreement = await db.query.interfaceAgreements.findFirst({
        where: eq(interfaceAgreements.id, input.agreementId),
      });
      if (!agreement) throw new Error("Agreement not found");

      const existing = await db
        .select({ count: sql<number>`count(*)` })
        .from(interfacePoints)
        .where(eq(interfacePoints.agreementId, input.agreementId));
      let nextNum = Number(existing[0].count) + 1;

      const values = input.rows.map((row) => {
        const code = `${agreement.code.replace("IA", "IP")}-${String(nextNum).padStart(3, "0")}`;
        nextNum++;
        return {
          agreementId: input.agreementId,
          code,
          title: row.title,
          description: row.description ?? null,
          criticality: (row.criticality ?? "minor") as "critical" | "major" | "minor",
          phase: row.phase ?? null,
          dueDate: normalizeDateForCreate(row.dueDate),
        };
      });

      await db.insert(interfacePoints).values(values);
      return { created: values.length };
    }),
});
