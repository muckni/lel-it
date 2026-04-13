import { describe, expect, it } from "vitest";
import {
  calculateTrackAApprovalLevel,
  deriveCycleMilestones,
  workflowAfterTriage,
} from "../lib/lesson-workflow";

describe("lesson workflow rules", () => {
  it("maps triage retain to triaged", () => {
    expect(workflowAfterTriage("retain")).toBe("triaged");
  });

  it("maps non-retain triage decisions to report_ready", () => {
    expect(workflowAfterTriage("drop")).toBe("report_ready");
    expect(workflowAfterTriage("defer")).toBe("report_ready");
    expect(workflowAfterTriage("hold")).toBe("report_ready");
    expect(workflowAfterTriage("duplicate")).toBe("report_ready");
    expect(workflowAfterTriage("external_context")).toBe("report_ready");
  });

  it("calculates approval levels using configurable thresholds", () => {
    const policy = { trackAApprovalEur250k: 250_000, trackAApprovalEur1m: 1_000_000 };

    expect(calculateTrackAApprovalLevel(100_000, policy)).toBe("epc_director");
    expect(calculateTrackAApprovalLevel(600_000, policy)).toBe("project_director");
    expect(calculateTrackAApprovalLevel(2_000_000, policy)).toBe("change_order_escalation");
  });

  it("derives T-6..T-1 milestones from gate date", () => {
    const gateDate = new Date("2026-08-15T00:00:00.000Z");
    const milestones = deriveCycleMilestones(gateDate);

    expect(milestones.gateDate).toBe("2026-08-15");
    expect(milestones.tMinus6At?.toISOString()).toBe("2026-07-04T00:00:00.000Z");
    expect(milestones.tMinus1At?.toISOString()).toBe("2026-08-08T00:00:00.000Z");
  });
});
