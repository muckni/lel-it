import { describe, expect, it } from "vitest";
import {
  assertProjectActionV2TransitionRequirements,
  canTransitionLessonV2,
  isProjectActionOverdue,
} from "../lib/lesson-v2-workflow";

describe("lesson v2 workflow guards", () => {
  it("allows only defined lesson transitions", () => {
    expect(canTransitionLessonV2("lesson", "draft", "submitted")).toBe(true);
    expect(canTransitionLessonV2("lesson", "draft", "validated")).toBe(false);
    expect(canTransitionLessonV2("lesson", "validated", "archived")).toBe(true);
  });

  it("guards project action assignment requirements", () => {
    expect(() =>
      assertProjectActionV2TransitionRequirements("added_to_project", "assigned", {
        ownerUserId: "user-1",
        deadline: "2026-08-15",
      })
    ).not.toThrow();

    expect(() =>
      assertProjectActionV2TransitionRequirements("added_to_project", "assigned", {})
    ).toThrow("Owner and deadline");
  });

  it("requires reasons for blocked and cancelled transitions", () => {
    expect(() =>
      assertProjectActionV2TransitionRequirements("in_progress", "blocked", {})
    ).toThrow("Blocked actions require a reason");

    expect(() =>
      assertProjectActionV2TransitionRequirements("assigned", "cancelled", {})
    ).toThrow("Cancelled actions require a reason");
  });

  it("requires evidence before evidence submission", () => {
    expect(() =>
      assertProjectActionV2TransitionRequirements("implemented", "evidence_submitted", {
        evidenceCount: 0,
      })
    ).toThrow("At least one evidence item");
  });

  it("enforces verifier separation of duties", () => {
    expect(() =>
      assertProjectActionV2TransitionRequirements("evidence_submitted", "verified", {
        ownerUserId: "user-1",
        actorUserId: "user-1",
      })
    ).toThrow("verifier must be different");
  });

  it("treats overdue as a derived condition, not a status", () => {
    expect(
      isProjectActionOverdue("in_progress", "2026-06-01", new Date("2026-06-12"))
    ).toBe(true);
    expect(isProjectActionOverdue("closed", "2026-06-01", new Date("2026-06-12"))).toBe(
      false
    );
  });
});
