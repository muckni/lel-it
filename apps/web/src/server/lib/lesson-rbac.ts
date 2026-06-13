import {
  db,
  projectLessonRoleAssignments,
  projectMembers,
} from "@owit/db";
import { and, eq } from "drizzle-orm";
import { assertMember } from "@/server/lib/rbac";

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
