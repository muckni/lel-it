import { describe, expect, it } from "vitest";
import {
  DEFAULT_SLA_POLICY,
  computeDefaultSlaDueAt,
  isValidLifecycleTransition,
  resolveRequiredMocApprovalLevels,
} from "@owit/shared";

describe("interface compliance lifecycle transitions", () => {
  it("allows sequential transitions", () => {
    expect(isValidLifecycleTransition("draft_dir", "employer_validated")).toBe(true);
    expect(isValidLifecycleTransition("employer_validated", "forwarded")).toBe(true);
    expect(isValidLifecycleTransition("forwarded", "answered")).toBe(true);
    expect(isValidLifecycleTransition("answered", "reviewed")).toBe(true);
    expect(isValidLifecycleTransition("reviewed", "accepted")).toBe(true);
    expect(isValidLifecycleTransition("accepted", "closed")).toBe(true);
  });

  it("blocks skipping states", () => {
    expect(isValidLifecycleTransition("draft_dir", "forwarded")).toBe(false);
    expect(isValidLifecycleTransition("answered", "closed")).toBe(false);
  });

  it("allows reopening only from closed", () => {
    expect(isValidLifecycleTransition("closed", "reopened")).toBe(true);
    expect(isValidLifecycleTransition("accepted", "reopened")).toBe(false);
  });
});

describe("interface compliance sla defaults", () => {
  it("uses 14-day default base policy", () => {
    const created = new Date("2026-01-01T10:00:00.000Z");
    const due = computeDefaultSlaDueAt(created, DEFAULT_SLA_POLICY);
    expect(due.getDate() - created.getDate()).toBe(14);
  });
});

describe("moc approval routing rules", () => {
  it("routes sub-250k changes to engineering manager + epc director", () => {
    expect(
      resolveRequiredMocApprovalLevels({
        costImpactEur: 100000,
        scheduleImpact: false,
        hseqImpact: false,
      })
    ).toEqual(["engineering_manager", "epc_director"]);
  });

  it("routes >=250k changes through project director", () => {
    expect(
      resolveRequiredMocApprovalLevels({
        costImpactEur: 300000,
        scheduleImpact: false,
        hseqImpact: false,
      })
    ).toEqual(["engineering_manager", "project_director"]);
  });

  it("routes >=1m changes through steerco/excom", () => {
    expect(
      resolveRequiredMocApprovalLevels({
        costImpactEur: 1500000,
        scheduleImpact: false,
        hseqImpact: false,
      })
    ).toEqual(["engineering_manager", "project_director", "steerco_excom"]);
  });
});
