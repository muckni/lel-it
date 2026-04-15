import { LESSON_OWNERSHIP_STATES, type LessonOwnershipState } from "@owit/shared";
import { TRPCError } from "@trpc/server";
import { getProjectRole } from "@/server/lib/rbac";
import { listLessonRolesForUser } from "@/server/lib/lesson-rbac";

const ALL_OWNERSHIP_STATES = [...LESSON_OWNERSHIP_STATES] as LessonOwnershipState[];

export async function getVisibleLessonOwnershipStates(
  projectId: string,
  userId: string
): Promise<LessonOwnershipState[]> {
  const [baseRole, lessonRoles] = await Promise.all([
    getProjectRole(userId, projectId),
    listLessonRolesForUser(projectId, userId),
  ]);

  if (baseRole === "admin") {
    return ALL_OWNERSHIP_STATES;
  }

  const hasSensitiveLessonRole = lessonRoles.some((role) =>
    ["ll_manager", "document_controller", "pmo_director", "hope"].includes(role)
  );

  if (baseRole === "editor" || hasSensitiveLessonRole) {
    return ["permissive", "restricted", "unclear"];
  }

  return ["permissive"];
}

export async function assertLessonOwnershipVisible(
  projectId: string,
  userId: string,
  ownershipState: LessonOwnershipState
) {
  const visibleStates = await getVisibleLessonOwnershipStates(projectId, userId);
  if (!visibleStates.includes(ownershipState)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Lesson is not visible for your role",
    });
  }
}
