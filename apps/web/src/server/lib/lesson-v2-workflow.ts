import { TRPCError } from "@trpc/server";

export type LessonV2Status =
  | "draft"
  | "submitted"
  | "under_review"
  | "validated"
  | "rejected"
  | "archived";

export type LessonClusterV2Status = "draft" | "under_review" | "approved" | "archived";

export type RecommendedActionV2Status =
  | "draft"
  | "project_approved"
  | "proposed_for_corporate"
  | "corporate_review"
  | "corporate_approved"
  | "corporate_rejected"
  | "retired";

export type CorporateActionV2Status = "active" | "under_review" | "retired";

export type ProjectActionV2Status =
  | "added_to_project"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "implemented"
  | "evidence_submitted"
  | "verified"
  | "closed"
  | "cancelled";

export type LessonV2EntityType =
  | "lesson"
  | "lesson_cluster"
  | "recommended_action"
  | "corporate_recommended_action"
  | "project_action";

type StatusByEntity = {
  lesson: LessonV2Status;
  lesson_cluster: LessonClusterV2Status;
  recommended_action: RecommendedActionV2Status;
  corporate_recommended_action: CorporateActionV2Status;
  project_action: ProjectActionV2Status;
};

export const LESSON_V2_TRANSITIONS = {
  lesson: {
    draft: ["submitted", "archived"],
    submitted: ["under_review"],
    under_review: ["validated", "rejected", "draft"],
    validated: ["archived"],
    rejected: ["draft", "archived"],
    archived: [],
  },
  lesson_cluster: {
    draft: ["under_review", "archived"],
    under_review: ["approved", "draft", "archived"],
    approved: ["archived"],
    archived: [],
  },
  recommended_action: {
    draft: ["project_approved", "retired"],
    project_approved: ["proposed_for_corporate", "retired"],
    proposed_for_corporate: ["corporate_review"],
    corporate_review: ["corporate_approved", "corporate_rejected", "project_approved"],
    corporate_approved: ["retired"],
    corporate_rejected: ["proposed_for_corporate", "retired"],
    retired: [],
  },
  corporate_recommended_action: {
    active: ["under_review", "retired"],
    under_review: ["active", "retired"],
    retired: [],
  },
  project_action: {
    added_to_project: ["assigned", "cancelled"],
    assigned: ["in_progress", "cancelled"],
    in_progress: ["blocked", "implemented", "cancelled"],
    blocked: ["in_progress", "cancelled"],
    implemented: ["evidence_submitted"],
    evidence_submitted: ["verified", "in_progress"],
    verified: ["closed"],
    closed: [],
    cancelled: [],
  },
} as const satisfies {
  [Entity in LessonV2EntityType]: Record<StatusByEntity[Entity], readonly StatusByEntity[Entity][]>;
};

export function canTransitionLessonV2<Entity extends LessonV2EntityType>(
  entityType: Entity,
  fromStatus: StatusByEntity[Entity],
  toStatus: StatusByEntity[Entity]
) {
  const transitions = LESSON_V2_TRANSITIONS[entityType] as Record<string, readonly string[]>;
  return transitions[String(fromStatus)]?.includes(String(toStatus)) ?? false;
}

export function assertLessonV2Transition<Entity extends LessonV2EntityType>(
  entityType: Entity,
  fromStatus: StatusByEntity[Entity],
  toStatus: StatusByEntity[Entity]
) {
  if (!canTransitionLessonV2(entityType, fromStatus, toStatus)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Cannot transition ${entityType} from ${fromStatus} to ${toStatus}`,
    });
  }
}

export type ProjectActionTransitionContext = {
  ownerUserId?: string | null;
  deadline?: Date | string | null;
  blockedReason?: string | null;
  cancellationReason?: string | null;
  evidenceCount?: number;
  actorUserId?: string;
  verifierUserId?: string;
};

export function assertProjectActionV2TransitionRequirements(
  fromStatus: ProjectActionV2Status,
  toStatus: ProjectActionV2Status,
  context: ProjectActionTransitionContext
) {
  assertLessonV2Transition("project_action", fromStatus, toStatus);

  if (toStatus === "assigned" && (!context.ownerUserId || !context.deadline)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Owner and deadline are required before assigning a project action",
    });
  }

  if (toStatus === "blocked" && !context.blockedReason?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Blocked actions require a reason",
    });
  }

  if (toStatus === "cancelled" && !context.cancellationReason?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cancelled actions require a reason",
    });
  }

  if (toStatus === "evidence_submitted" && (context.evidenceCount ?? 0) < 1) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one evidence item is required before evidence submission",
    });
  }

  if (
    toStatus === "verified" &&
    context.ownerUserId &&
    (context.verifierUserId ?? context.actorUserId) === context.ownerUserId
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Project action verifier must be different from the owner",
    });
  }
}

export function isProjectActionOverdue(
  status: ProjectActionV2Status,
  deadline: Date | string | null | undefined,
  now = new Date()
) {
  if (!deadline || ["closed", "cancelled", "verified"].includes(status)) return false;
  return new Date(deadline).getTime() < now.getTime();
}
