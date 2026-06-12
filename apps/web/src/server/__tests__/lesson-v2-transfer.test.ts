import { describe, expect, it } from "vitest";
import {
  CORPORATE_REVIEW_CHECKLIST,
  assertCorporateTransferAllowed,
  buildLessonV2AuditEvent,
  createProjectActionCopyFromCorporate,
  isCorporateTransferAllowed,
  missingCorporateChecklistItems,
  type CorporateTransferChecklist,
} from "../lib/lesson-v2-transfer";

const completeChecklist = Object.fromEntries(
  CORPORATE_REVIEW_CHECKLIST.map((item) => [item, true])
) as CorporateTransferChecklist;

describe("lesson v2 transfer helpers", () => {
  it("blocks strictly confidential corporate transfer", () => {
    expect(isCorporateTransferAllowed("strictly_confidential", completeChecklist)).toBe(false);
    expect(() => assertCorporateTransferAllowed("strictly_confidential")).toThrow(
      "Strictly confidential"
    );
  });

  it("requires a complete checklist for confidential transfer", () => {
    expect(isCorporateTransferAllowed("confidential", completeChecklist)).toBe(true);
    expect(isCorporateTransferAllowed("confidential", {})).toBe(false);
    expect(missingCorporateChecklistItems({})).toEqual(CORPORATE_REVIEW_CHECKLIST);
  });

  it("copies content but keeps source identity as immutable reference fields", () => {
    const copy = createProjectActionCopyFromCorporate({
      projectId: "project-1",
      createdById: "user-1",
      corporateAction: {
        id: "corporate-action-1",
        version: 3,
        title: "Require supplier input freeze before design gate",
        actionDescription: "Set and govern a supplier input freeze.",
        implementationGuidance: "Add the freeze to the gate checklist.",
        categoryId: "category-1",
        tags: ["supplier", "gate"],
      },
    });

    expect(copy).toMatchObject({
      projectId: "project-1",
      title: "Require supplier input freeze before design gate",
      status: "added_to_project",
      sourceCorporateActionId: "corporate-action-1",
      sourceCorporateActionVersion: 3,
    });
    expect(copy).not.toHaveProperty("ownerUserId");
    expect(copy).not.toHaveProperty("deadline");
  });

  it("builds append-only audit payloads for router persistence", () => {
    const event = buildLessonV2AuditEvent({
      entityType: "project_action",
      entityId: "action-1",
      eventType: "status_changed",
      actorId: "user-1",
      previousValue: { status: "assigned" },
      newValue: { status: "in_progress" },
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
    });

    expect(event).toEqual({
      entityType: "project_action",
      entityId: "action-1",
      eventType: "status_changed",
      actorId: "user-1",
      projectId: null,
      previousValue: { status: "assigned" },
      newValue: { status: "in_progress" },
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
    });
  });
});
