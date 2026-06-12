import { TRPCError } from "@trpc/server";
import type { LessonEntityType } from "@owit/shared";

export type ConfidentialityLevel = "internal" | "confidential" | "strictly_confidential";

export const CORPORATE_REVIEW_CHECKLIST = [
  "no_supplier_or_vendor_names",
  "no_exact_commercial_figures_or_contract_data",
  "no_personal_names_or_personal_data",
  "guidance_generalised_beyond_source_project",
  "action_concrete_enough_to_implement",
  "duplicate_checked_or_supersedes_existing",
  "category_reusability_and_applicability_set",
] as const;

export type CorporateReviewChecklistItem = (typeof CORPORATE_REVIEW_CHECKLIST)[number];

export type CorporateTransferChecklist = Record<CorporateReviewChecklistItem, boolean>;

export type CorporateActionSource = {
  id: string;
  version: number;
  title: string;
  actionDescription: string;
  implementationGuidance: string | null;
  categoryId: string | null;
  tags?: readonly string[];
};

export type ProjectActionCopyInput = {
  corporateAction: CorporateActionSource;
  projectId: string;
  createdById: string;
  duplicateOverrideReason?: string | null;
};

export function isCorporateTransferAllowed(
  confidentialityLevel: ConfidentialityLevel,
  checklist?: Partial<CorporateTransferChecklist>
) {
  if (confidentialityLevel === "strictly_confidential") return false;
  if (confidentialityLevel === "internal") return true;
  return CORPORATE_REVIEW_CHECKLIST.every((item) => checklist?.[item] === true);
}

export function assertCorporateTransferAllowed(
  confidentialityLevel: ConfidentialityLevel,
  checklist?: Partial<CorporateTransferChecklist>
) {
  if (confidentialityLevel === "strictly_confidential") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Strictly confidential content cannot be transferred to Corporate",
    });
  }

  if (!isCorporateTransferAllowed(confidentialityLevel, checklist)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Confidential content requires a completed sanitisation checklist",
    });
  }
}

export function missingCorporateChecklistItems(
  checklist: Partial<CorporateTransferChecklist>
) {
  return CORPORATE_REVIEW_CHECKLIST.filter((item) => checklist[item] !== true);
}

export function createProjectActionCopyFromCorporate({
  corporateAction,
  projectId,
  createdById,
  duplicateOverrideReason,
}: ProjectActionCopyInput) {
  return {
    projectId,
    title: corporateAction.title,
    actionDescription: corporateAction.actionDescription,
    implementationGuidance: corporateAction.implementationGuidance,
    categoryId: corporateAction.categoryId,
    tags: [...(corporateAction.tags ?? [])],
    status: "added_to_project" as const,
    sourceCorporateActionId: corporateAction.id,
    sourceCorporateActionVersion: corporateAction.version,
    createdById,
    duplicateOverrideReason: duplicateOverrideReason?.trim() || null,
  };
}

export type LessonV2AuditEventInput = {
  entityType: LessonEntityType;
  entityId: string;
  eventType: string;
  actorId: string;
  projectId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  note?: string | null;
  createdAt?: Date;
};

export function buildLessonV2AuditEvent(input: LessonV2AuditEventInput) {
  return {
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    actorId: input.actorId,
    projectId: input.projectId ?? null,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    note: input.note ?? null,
    createdAt: input.createdAt ?? new Date(),
  };
}
