import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Mock @owit/db ────────────────────────────────────────────────────────────
const mockFindFirst = vi.fn();

vi.mock("@owit/db", () => ({
  db: {
    query: {
      projectMembers: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    },
  },
  projectMembers: { userId: "user_id", projectId: "project_id" },
}));

// ── Import after mock ────────────────────────────────────────────────────────
const { requireRole, assertMember, getProjectRole } = await import(
  "../lib/rbac"
);

// ── Helpers ──────────────────────────────────────────────────────────────────
const userId = "user-123";
const projectId = "proj-456";

function memberWith(role: "admin" | "editor" | "viewer") {
  return { role };
}

describe("requireRole", () => {
  beforeEach(() => mockFindFirst.mockReset());

  it("allows admin to pass admin check", async () => {
    mockFindFirst.mockResolvedValue(memberWith("admin"));
    await expect(requireRole(userId, projectId, "admin")).resolves.toBeUndefined();
  });

  it("allows admin to pass editor check", async () => {
    mockFindFirst.mockResolvedValue(memberWith("admin"));
    await expect(requireRole(userId, projectId, "editor")).resolves.toBeUndefined();
  });

  it("allows editor to pass editor check", async () => {
    mockFindFirst.mockResolvedValue(memberWith("editor"));
    await expect(requireRole(userId, projectId, "editor")).resolves.toBeUndefined();
  });

  it("blocks editor from admin-only action", async () => {
    mockFindFirst.mockResolvedValue(memberWith("editor"));
    await expect(requireRole(userId, projectId, "admin")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks viewer from editor action", async () => {
    mockFindFirst.mockResolvedValue(memberWith("viewer"));
    await expect(requireRole(userId, projectId, "editor")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks viewer from admin action", async () => {
    mockFindFirst.mockResolvedValue(memberWith("viewer"));
    await expect(requireRole(userId, projectId, "admin")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("blocks non-member (null result)", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(requireRole(userId, projectId, "viewer")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("assertMember", () => {
  beforeEach(() => mockFindFirst.mockReset());

  it("allows viewer to pass", async () => {
    mockFindFirst.mockResolvedValue(memberWith("viewer"));
    await expect(assertMember(userId, projectId)).resolves.toBeUndefined();
  });

  it("blocks non-member", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(assertMember(userId, projectId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("getProjectRole", () => {
  beforeEach(() => mockFindFirst.mockReset());

  it("returns role for member", async () => {
    mockFindFirst.mockResolvedValue(memberWith("editor"));
    const role = await getProjectRole(userId, projectId);
    expect(role).toBe("editor");
  });

  it("returns null for non-member", async () => {
    mockFindFirst.mockResolvedValue(null);
    const role = await getProjectRole(userId, projectId);
    expect(role).toBeNull();
  });
});
