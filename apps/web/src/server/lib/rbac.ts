import { TRPCError } from "@trpc/server";
import { db, projectMembers } from "@owit/db";
import { and, eq } from "drizzle-orm";

type Role = "viewer" | "editor" | "admin";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

/**
 * Throws FORBIDDEN if the user doesn't hold at least `minRole`.
 * Throws NOT_FOUND (masked as FORBIDDEN) if user is not a member at all.
 */
export async function requireRole(
  userId: string,
  projectId: string,
  minRole: Role
): Promise<void> {
  const member = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.userId, userId),
      eq(projectMembers.projectId, projectId)
    ),
    columns: { role: true },
  });

  if (!member || RANK[member.role as Role] < RANK[minRole]) {
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
  return (member?.role as Role) ?? null;
}
