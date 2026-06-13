/**
 * Router authorization smoke tests.
 * Verifies that each critical mutation throws FORBIDDEN when the caller lacks
 * the required role, without touching a real database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Stable UUIDs used throughout (valid v4 format: version=4, variant=[89ab]) ─
const PROJ = "00000000-0000-4000-8000-000000000001";
const MEM = "00000000-0000-4000-8000-000000000007";

// ── Mock requireRole to be controllable per test ────────────────────────────
const mockRequireRole = vi.fn();
const mockAssertMember = vi.fn();

vi.mock("@/server/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  assertMember: (...args: unknown[]) => mockAssertMember(...args),
  getProjectRole: vi.fn().mockResolvedValue("editor"),
}));

// ── Mock DB to avoid real queries ─────────────────────────────────────────────
vi.mock("@owit/db", () => ({
  db: {
    query: {
      projectMembers: { findFirst: vi.fn() },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count: 0 }]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000001" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  },
  projectMembers: {},
  notifications: {},
}));

vi.mock("@/server/lib/log-activity", () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}));

// ── Context builders ─────────────────────────────────────────────────────────
const viewerCtx = { user: { id: "viewer-user", email: "viewer@test.com" } };

function viewerForbids(fn: () => Promise<unknown>) {
  return expect(fn()).rejects.toMatchObject({ code: "FORBIDDEN" });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("project member management requires admin", () => {
  beforeEach(() => {
    mockRequireRole.mockReset();
    mockAssertMember.mockResolvedValue(undefined);
  });

  it("project.addMember is blocked for editor", async () => {
    mockRequireRole.mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "Requires admin role" })
    );
    const { projectRouter } = await import("../routers/project");
    const caller = projectRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.addMember({ projectId: PROJ, email: "x@test.com", role: "viewer" })
    );
  });

  it("project.removeMember is blocked for editor", async () => {
    mockRequireRole.mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "Requires admin role" })
    );
    const { projectRouter } = await import("../routers/project");
    const caller = projectRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.removeMember({ projectId: PROJ, memberId: MEM })
    );
  });
});
