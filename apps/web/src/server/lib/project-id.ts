/**
 * Resolve the projectId for any entity type.
 * Throws NOT_FOUND if the entity doesn't exist (prevents ID enumeration).
 */
import { TRPCError } from "@trpc/server";
import {
  db,
  interfaceRegisters,
  interfaceAgreements,
  interfacePoints,
  interfaceQueries,
  deliverables,
  iqResponses,
  workPackages,
  assetPlacements,
  comments,
  lessonsLearned,
} from "@owit/db";
import { eq } from "drizzle-orm";

function notFound(entity: string): never {
  throw new TRPCError({ code: "NOT_FOUND", message: `${entity} not found` });
}

export async function projectIdForRegister(id: string): Promise<string> {
  const row = await db.query.interfaceRegisters.findFirst({
    where: eq(interfaceRegisters.id, id),
    columns: { projectId: true },
  });
  return row?.projectId ?? notFound("Register");
}

export async function projectIdForAgreement(id: string): Promise<string> {
  const row = await db.query.interfaceAgreements.findFirst({
    where: eq(interfaceAgreements.id, id),
    with: { register: { columns: { projectId: true } } },
  });
  return row?.register?.projectId ?? notFound("Agreement");
}

export async function projectIdForPoint(id: string): Promise<string> {
  const row = await db.query.interfacePoints.findFirst({
    where: eq(interfacePoints.id, id),
    with: {
      agreement: { with: { register: { columns: { projectId: true } } } },
    },
  });
  return row?.agreement?.register?.projectId ?? notFound("Interface point");
}

export async function projectIdForQuery(id: string): Promise<string> {
  const row = await db.query.interfaceQueries.findFirst({
    where: eq(interfaceQueries.id, id),
    columns: { interfacePointId: true },
  });
  if (!row) notFound("Interface query");
  return projectIdForPoint(row.interfacePointId);
}

export async function projectIdForDeliverable(id: string): Promise<string> {
  const row = await db.query.deliverables.findFirst({
    where: eq(deliverables.id, id),
    columns: { interfacePointId: true },
  });
  if (!row) notFound("Deliverable");
  return projectIdForPoint(row.interfacePointId);
}

export async function projectIdForIqResponse(id: string): Promise<string> {
  const row = await db.query.iqResponses.findFirst({
    where: eq(iqResponses.id, id),
    columns: { queryId: true },
  });
  if (!row) notFound("IQ response");
  return projectIdForQuery(row.queryId);
}

export async function projectIdForWorkPackage(id: string): Promise<string> {
  const row = await db.query.workPackages.findFirst({
    where: eq(workPackages.id, id),
    columns: { projectId: true },
  });
  return row?.projectId ?? notFound("Work package");
}

export async function projectIdForAssetPlacement(id: string): Promise<string> {
  const row = await db.query.assetPlacements.findFirst({
    where: eq(assetPlacements.id, id),
    columns: { projectId: true },
  });
  return row?.projectId ?? notFound("Asset placement");
}

export async function projectIdForComment(
  parentId: string,
  parentType: "interface_point" | "interface_query" | "lesson_learned"
): Promise<string> {
  if (parentType === "interface_point") return projectIdForPoint(parentId);
  if (parentType === "interface_query") return projectIdForQuery(parentId);
  return projectIdForLessonLearned(parentId);
}

export async function projectIdForLessonLearned(id: string): Promise<string> {
  const row = await db.query.lessonsLearned.findFirst({
    where: eq(lessonsLearned.id, id),
    columns: { projectId: true },
  });
  return row?.projectId ?? notFound("Lesson learned");
}
