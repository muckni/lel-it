import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/rbac", () => ({
  getProjectRole: vi.fn(),
}));

vi.mock("../lib/lesson-rbac", () => ({
  listLessonRolesForUser: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({ kind: "eq" })),
}));

vi.mock("@owit/db", () => ({
  db: {
    query: {
      userCorporateRoles: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
  userCorporateRoles: { userId: "user_id" },
}));

const {
  canCorporateRolePerform,
  canProjectRolePerform,
  deriveV2ProjectRole,
  getV2CorporateRoleForUser,
} = await import("../lib/lesson-v2-rbac");

describe("lesson v2 RBAC helpers", () => {
  it("maps existing project and lesson roles onto v2 project roles", () => {
    expect(deriveV2ProjectRole("admin", [])).toBe("ll_lead");
    expect(deriveV2ProjectRole("viewer", ["ll_manager"])).toBe("ll_lead");
    expect(deriveV2ProjectRole("editor", [])).toBe("reviewer");
    expect(deriveV2ProjectRole("viewer", ["document_controller"])).toBe("reviewer");
    expect(deriveV2ProjectRole("viewer", [])).toBe("viewer");
    expect(deriveV2ProjectRole(null, [])).toBeNull();
  });

  it("allows reviewers to validate lessons but not approve project recommendations", () => {
    expect(canProjectRolePerform("reviewer", "validate_lesson")).toBe(true);
    expect(canProjectRolePerform("reviewer", "approve_recommended_action")).toBe(false);
  });

  it("keeps add-to-project behind reviewer or lead permissions", () => {
    expect(canProjectRolePerform("ll_lead", "add_corporate_action_to_project")).toBe(true);
    expect(canProjectRolePerform("reviewer", "add_corporate_action_to_project")).toBe(true);
    expect(canProjectRolePerform("contributor", "add_corporate_action_to_project")).toBe(false);
    expect(canProjectRolePerform("viewer", "add_corporate_action_to_project")).toBe(false);
  });

  it("supports the viewer plus export flag without widening viewer writes", () => {
    expect(canProjectRolePerform("viewer", "generate_gate_review_export")).toBe(false);
    expect(canProjectRolePerform("viewer", "generate_gate_review_export", { canExport: true })).toBe(
      true
    );
    expect(canProjectRolePerform("viewer", "create_lesson", { canExport: true })).toBe(false);
  });

  it("separates corporate manager capabilities from platform admin", () => {
    expect(canCorporateRolePerform("corporate_ll_manager", "publish_corporate_action")).toBe(
      true
    );
    expect(canCorporateRolePerform("corporate_admin", "publish_corporate_action")).toBe(false);
    expect(canCorporateRolePerform("senior_management", "view_corporate_dashboard")).toBe(true);
    expect(canCorporateRolePerform("senior_management", "publish_corporate_action")).toBe(false);
    expect(canCorporateRolePerform("corporate_viewer", "browse_corporate_library")).toBe(true);
  });

  it("defaults authenticated users to corporate library browse access", async () => {
    await expect(getV2CorporateRoleForUser("user-1")).resolves.toBe("corporate_viewer");
  });
});
