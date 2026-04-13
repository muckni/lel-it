import { TRPCError } from "@trpc/server";
import {
  db,
  projectLessonRoleAssignments,
  projectMembers,
} from "@owit/db";
import { and, eq, inArray } from "drizzle-orm";
import { assertMember, getProjectRole } from "@/server/lib/rbac";

export type LessonRoleType =
  | "ll_manager"
  | "document_controller"
  | "pmo_director"
  | "hope";

export async function listLessonRolesForUser(projectId: string, userId: string) {
  const member = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    columns: { id: true },
  });
  if (!member) {
    await assertMember(userId, projectId);
    return [] as LessonRoleType[];
  }

  const roles = await db.query.projectLessonRoleAssignments.findMany({
    where: and(
      eq(projectLessonRoleAssignments.projectId, projectId),
      eq(projectLessonRoleAssignments.memberId, member.id)
    ),
    columns: { roleType: true },
  });

  return roles.map((row) => row.roleType as LessonRoleType);
}

export async function requireLessonRole(
  projectId: string,
  userId: string,
  allowedRoles: LessonRoleType[]
) {
  await assertMember(userId, projectId);

  const baseRole = await getProjectRole(userId, projectId);
  if (baseRole === "admin") {
    return;
  }

  const member = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    columns: { id: true },
  });

  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Project membership required" });
  }

  const row = await db.query.projectLessonRoleAssignments.findFirst({
    where: and(
      eq(projectLessonRoleAssignments.projectId, projectId),
      eq(projectLessonRoleAssignments.memberId, member.id),
      inArray(projectLessonRoleAssignments.roleType, allowedRoles)
    ),
    columns: { id: true },
  });

  if (!row) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Requires lesson role: ${allowedRoles.join(", ")}`,
    });
  }
}
