/**
 * Router authorization smoke tests.
 * Verifies that each critical mutation throws FORBIDDEN when the caller lacks
 * the required role, without touching a real database.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Stable UUIDs used throughout (valid v4 format: version=4, variant=[89ab]) ─
const PROJ  = "00000000-0000-4000-8000-000000000001";
const REG   = "00000000-0000-4000-8000-000000000002";
const AGR   = "00000000-0000-4000-8000-000000000003";
const PT    = "00000000-0000-4000-8000-000000000004";
const PKG_A = "00000000-0000-4000-8000-000000000005";
const PKG_B = "00000000-0000-4000-8000-000000000006";
const MEM   = "00000000-0000-4000-8000-000000000007";

// ── Shared FORBIDDEN error ───────────────────────────────────────────────────
const FORBIDDEN = new TRPCError({ code: "FORBIDDEN", message: "Requires editor role" });

// ── Mock requireRole to be controllable per test ────────────────────────────
const mockRequireRole = vi.fn();
const mockAssertMember = vi.fn();

vi.mock("@/server/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
  assertMember: (...args: unknown[]) => mockAssertMember(...args),
  getProjectRole: vi.fn().mockResolvedValue("editor"),
}));

// ── Mock DB to avoid real queries ─────────────────────────────────────────────
// Note: vi.mock factories are hoisted and run before const declarations,
// so UUID values are inlined rather than referenced via constants.
vi.mock("@owit/db", () => ({
  db: {
    query: {
      projectMembers: { findFirst: vi.fn() },
      interfaceRegisters: {
        findFirst: vi.fn().mockResolvedValue({ projectId: "00000000-0000-4000-8000-000000000001" }),
      },
      interfaceAgreements: {
        findFirst: vi.fn().mockResolvedValue({ registerId: "00000000-0000-4000-8000-000000000001", code: "IA-001" }),
      },
      interfacePoints: {
        findFirst: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000004", agreementId: "00000000-0000-4000-8000-000000000003" }),
      },
      workPackages: { findMany: vi.fn().mockResolvedValue([]) },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ count: 0 }]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "00000000-0000-4000-8000-000000000001", code: "IP-001", title: "Test" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  },
  projectMembers: {},
  workPackages: {},
  interfaceRegisters: {},
  interfaceAgreements: {},
  interfacePoints: {},
  interfaceQueries: {},
  deliverables: {},
  assetPlacements: {},
  memberWorkPackages: {},
}));

vi.mock("@/server/lib/project-id", () => ({
  projectIdForRegister:      vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000001"),
  projectIdForAgreement:     vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000001"),
  projectIdForPoint:         vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000001"),
  projectIdForQuery:         vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000001"),
  projectIdForDeliverable:   vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000001"),
  projectIdForWorkPackage:   vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000001"),
  projectIdForAssetPlacement: vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000001"),
  projectIdForComment:       vi.fn().mockResolvedValue("00000000-0000-4000-8000-000000000001"),
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

describe("register mutations require editor+", () => {
  beforeEach(() => {
    mockRequireRole.mockReset();
    mockAssertMember.mockResolvedValue(undefined);
  });

  it("register.create is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { registerRouter } = await import("../routers/register");
    const caller = registerRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.create({ projectId: PROJ, name: "R1", packageAId: PKG_A, packageBId: PKG_B })
    );
  });

  it("register.delete is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { registerRouter } = await import("../routers/register");
    const caller = registerRouter.createCaller(viewerCtx as any);
    await viewerForbids(() => caller.delete({ id: REG }));
  });
});

describe("work-package mutations require editor+", () => {
  beforeEach(() => {
    mockRequireRole.mockReset();
    mockAssertMember.mockResolvedValue(undefined);
  });

  it("workPackage.create is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { workPackageRouter } = await import("../routers/work-package");
    const caller = workPackageRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.create({ projectId: PROJ, code: "WTG", name: "WTG", color: "#000000" })
    );
  });
});

describe("interface-point mutations require editor+", () => {
  beforeEach(() => {
    mockRequireRole.mockReset();
    mockAssertMember.mockResolvedValue(undefined);
  });

  it("interfacePoint.create is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { interfacePointRouter } = await import("../routers/interface-point");
    const caller = interfacePointRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.create({ agreementId: AGR, title: "Test point" })
    );
  });

  it("interfacePoint.delete is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { interfacePointRouter } = await import("../routers/interface-point");
    const caller = interfacePointRouter.createCaller(viewerCtx as any);
    await viewerForbids(() => caller.delete({ id: PT }));
  });

  it("interfacePoint.set3dAnchor is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { interfacePointRouter } = await import("../routers/interface-point");
    const caller = interfacePointRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.set3dAnchor({ id: PT, assetType: "turbine", anchorKey: "tower_base" })
    );
  });

  it("interfacePoint.clear3dAnchor is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { interfacePointRouter } = await import("../routers/interface-point");
    const caller = interfacePointRouter.createCaller(viewerCtx as any);
    await viewerForbids(() => caller.clear3dAnchor({ id: PT }));
  });
});

describe("interface-query mutations require editor+", () => {
  beforeEach(() => {
    mockRequireRole.mockReset();
    mockAssertMember.mockResolvedValue(undefined);
  });

  it("interfaceQuery.create is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { interfaceQueryRouter } = await import("../routers/interface-query");
    const caller = interfaceQueryRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.create({
        interfacePointId: PT,
        raisedByPackageId: PKG_A,
        assignedToPackageId: PKG_B,
        subject: "Test IQ",
      })
    );
  });
});

describe("deliverable mutations require editor+", () => {
  beforeEach(() => {
    mockRequireRole.mockReset();
    mockAssertMember.mockResolvedValue(undefined);
  });

  it("deliverable.create is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { deliverableRouter } = await import("../routers/deliverable");
    const caller = deliverableRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.create({ interfacePointId: PT, title: "Test deliverable" })
    );
  });
});

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
