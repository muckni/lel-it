import { db, activities, notifications, projectMembers } from "@owit/db";
import { eq } from "drizzle-orm";

interface ActivityPayload {
  projectId: string;
  userId: string;
  actorName: string;
  eventType: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  meta?: Record<string, unknown>;
  notificationMessage?: string;
}

/** Fire-and-forget: logs an activity and fans out notifications to project members */
export async function logActivity(payload: ActivityPayload): Promise<void> {
  await db.insert(activities).values({
    projectId: payload.projectId,
    userId: payload.userId,
    actorName: payload.actorName,
    eventType: payload.eventType,
    entityType: payload.entityType,
    entityId: payload.entityId,
    entityLabel: payload.entityLabel,
    meta: payload.meta ?? null,
  });

  if (payload.notificationMessage) {
    const members = await db
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, payload.projectId));

    const toNotify = members
      .map((m) => m.userId)
      .filter((id) => id !== payload.userId);

    if (toNotify.length > 0) {
      await db.insert(notifications).values(
        toNotify.map((userId) => ({
          userId,
          type: payload.eventType,
          referenceType: payload.entityType,
          referenceId: payload.entityId,
          message: payload.notificationMessage!,
        }))
      );
    }
  }
}
