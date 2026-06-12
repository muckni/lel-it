import { TRPCError } from "@trpc/server";
import { getProjectRole } from "@/server/lib/rbac";
import { listLessonRolesForUser, type LessonRoleType } from "@/server/lib/lesson-rbac";

type LegacyProjectRole = "admin" | "editor" | "viewer" | null;

export type V2ProjectRole = "ll_lead" | "reviewer" | "contributor" | "viewer";
export type V2CorporateRole =
  | "corporate_admin"
  | "corporate_ll_manager"
  | "senior_management"
  | "corporate_viewer";

export type V2ProjectCapability =
  | "access_project"
  | "create_lesson"
  | "edit_own_draft_lesson"
  | "edit_any_lesson"
  | "validate_lesson"
  | "create_cluster"
  | "create_recommended_action"
  | "approve_recommended_action"
  | "propose_corporate_transfer"
  | "add_corporate_action_to_project"
  | "assign_project_action"
  | "update_owned_project_action"
  | "verify_project_action"
  | "generate_gate_review_export";

export type V2CorporateCapability =
  | "browse_corporate_library"
  | "review_corporate_proposal"
  | "publish_corporate_action"
  | "edit_corporate_action"
  | "retire_corporate_action"
  | "view_corporate_dashboard"
  | "administer_platform";

const PROJECT_CAPABILITIES: Record<V2ProjectRole, readonly V2ProjectCapability[]> = {
  ll_lead: [
    "access_project",
    "create_lesson",
    "edit_own_draft_lesson",
    "edit_any_lesson",
    "validate_lesson",
    "create_cluster",
    "create_recommended_action",
    "approve_recommended_action",
    "propose_corporate_transfer",
    "add_corporate_action_to_project",
    "assign_project_action",
    "update_owned_project_action",
    "verify_project_action",
    "generate_gate_review_export",
  ],
  reviewer: [
    "access_project",
    "create_lesson",
    "edit_own_draft_lesson",
    "validate_lesson",
    "create_cluster",
    "create_recommended_action",
    "add_corporate_action_to_project",
    "update_owned_project_action",
  ],
  contributor: [
    "access_project",
    "create_lesson",
    "edit_own_draft_lesson",
    "update_owned_project_action",
  ],
  viewer: ["access_project"],
};

const CORPORATE_CAPABILITIES: Record<V2CorporateRole, readonly V2CorporateCapability[]> = {
  corporate_admin: [
    "browse_corporate_library",
    "view_corporate_dashboard",
    "administer_platform",
  ],
  corporate_ll_manager: [
    "browse_corporate_library",
    "review_corporate_proposal",
    "publish_corporate_action",
    "edit_corporate_action",
    "retire_corporate_action",
    "view_corporate_dashboard",
  ],
  senior_management: ["browse_corporate_library", "view_corporate_dashboard"],
  corporate_viewer: ["browse_corporate_library"],
};

export function deriveV2ProjectRole(
  baseRole: LegacyProjectRole,
  lessonRoles: readonly LessonRoleType[] = []
): V2ProjectRole | null {
  if (!baseRole) return null;
  if (baseRole === "admin") return "ll_lead";
  if (lessonRoles.some((role) => role === "ll_manager" || role === "pmo_director")) {
    return "ll_lead";
  }
  if (baseRole === "editor" || lessonRoles.includes("document_controller")) {
    return "reviewer";
  }
  return "viewer";
}

export function canProjectRolePerform(
  role: V2ProjectRole,
  capability: V2ProjectCapability,
  options: { canExport?: boolean } = {}
) {
  if (capability === "generate_gate_review_export" && role === "viewer") {
    return options.canExport === true;
  }
  return PROJECT_CAPABILITIES[role].includes(capability);
}

export function canCorporateRolePerform(
  role: V2CorporateRole,
  capability: V2CorporateCapability
) {
  return CORPORATE_CAPABILITIES[role].includes(capability);
}

export async function getV2ProjectRoleForUser(projectId: string, userId: string) {
  const [baseRole, lessonRoles] = await Promise.all([
    getProjectRole(userId, projectId),
    listLessonRolesForUser(projectId, userId),
  ]);
  return deriveV2ProjectRole(baseRole, lessonRoles);
}

export async function requireV2ProjectCapability(
  projectId: string,
  userId: string,
  capability: V2ProjectCapability,
  options: { canExport?: boolean } = {}
) {
  const role = await getV2ProjectRoleForUser(projectId, userId);
  if (!role || !canProjectRolePerform(role, capability, options)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Requires project capability: ${capability}`,
    });
  }
  return role;
}

export function requireV2CorporateCapability(
  role: V2CorporateRole | null | undefined,
  capability: V2CorporateCapability
) {
  if (!role || !canCorporateRolePerform(role, capability)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Requires corporate capability: ${capability}`,
    });
  }
}
