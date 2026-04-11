import { TRPCError } from "@trpc/server";
import { db, projectMembers, projects } from "@owit/db";
import { and, eq } from "drizzle-orm";

type Role = "viewer" | "editor" | "admin";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

async function ensureOwnerAdminMembership(
  userId: string,
  projectId: string
): Promise<Role | null> {
  const row = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true },
    with: {
      portfolio: {
        columns: { ownerId: true },
      },
    },
  });

  if (!row || row.portfolio.ownerId !== userId) {
    return null;
  }

  await db
    .insert(projectMembers)
    .values({
      projectId,
      userId,
      role: "admin",
    })
    .onConflictDoNothing();

  return "admin";
}

/**
 * Throws FORBIDDEN if the user doesn't hold at least `minRole`.
 * Throws NOT_FOUND (masked as FORBIDDEN) if user is not a member at all.
 */
export async function requireRole(
  userId: string,
  projectId: string,
  minRole: Role
): Promise<void> {
  let role = (await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.userId, userId),
      eq(projectMembers.projectId, projectId)
    ),
    columns: { role: true },
  }))?.role as Role | undefined;

  if (!role) {
    role = (await ensureOwnerAdminMembership(userId, projectId)) ?? undefined;
  }

  if (!role || RANK[role] < RANK[minRole]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Requires ${minRole} role`,
    });
  }
}

/** Alias: enforce project membership (read access) */
export const assertMember = (userId: string, projectId: string) =>
  requireRole(userId, projectId, "viewer");

/** Returns the user's role, or null if not a member */
export async function getProjectRole(
  userId: string,
  projectId: string
): Promise<Role | null> {
  const member = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.userId, userId),
      eq(projectMembers.projectId, projectId)
    ),
    columns: { role: true },
  });
  if (member?.role) {
    return member.role as Role;
  }
  return ensureOwnerAdminMembership(userId, projectId);
}
