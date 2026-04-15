import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetProjectRole = vi.fn();
const mockListLessonRolesForUser = vi.fn();

vi.mock("../lib/rbac", () => ({
  getProjectRole: (...args: unknown[]) => mockGetProjectRole(...args),
}));

vi.mock("../lib/lesson-rbac", () => ({
  listLessonRolesForUser: (...args: unknown[]) => mockListLessonRolesForUser(...args),
}));

const { assertLessonOwnershipVisible, getVisibleLessonOwnershipStates } = await import(
  "../lib/lesson-visibility"
);

describe("lesson visibility policy", () => {
  beforeEach(() => {
    mockGetProjectRole.mockReset();
    mockListLessonRolesForUser.mockReset();
  });

  it("returns all states for admins", async () => {
    mockGetProjectRole.mockResolvedValue("admin");
    mockListLessonRolesForUser.mockResolvedValue([]);

    await expect(
      getVisibleLessonOwnershipStates("project-1", "user-1")
    ).resolves.toEqual(["permissive", "restricted", "prohibited", "unclear"]);
  });

  it("allows restricted and unclear for editors", async () => {
    mockGetProjectRole.mockResolvedValue("editor");
    mockListLessonRolesForUser.mockResolvedValue([]);

    await expect(
      getVisibleLessonOwnershipStates("project-1", "user-1")
    ).resolves.toEqual(["permissive", "restricted", "unclear"]);
  });

  it("allows restricted and unclear for viewers with a lesson governance role", async () => {
    mockGetProjectRole.mockResolvedValue("viewer");
    mockListLessonRolesForUser.mockResolvedValue(["document_controller"]);

    await expect(
      getVisibleLessonOwnershipStates("project-1", "user-1")
    ).resolves.toEqual(["permissive", "restricted", "unclear"]);
  });

  it("limits plain viewers to permissive lessons", async () => {
    mockGetProjectRole.mockResolvedValue("viewer");
    mockListLessonRolesForUser.mockResolvedValue([]);

    await expect(
      getVisibleLessonOwnershipStates("project-1", "user-1")
    ).resolves.toEqual(["permissive"]);
  });

  it("rejects access to prohibited lessons for non-admin visibility", async () => {
    mockGetProjectRole.mockResolvedValue("editor");
    mockListLessonRolesForUser.mockResolvedValue([]);

    await expect(
      assertLessonOwnershipVisible("project-1", "user-1", "prohibited")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
