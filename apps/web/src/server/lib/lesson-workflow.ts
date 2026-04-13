export type LessonTriageDecision =
  | "retain"
  | "drop"
  | "defer"
  | "hold"
  | "duplicate"
  | "external_context";

export function workflowAfterTriage(decision: LessonTriageDecision) {
  if (decision === "retain") return "triaged" as const;
  return "report_ready" as const;
}

export function calculateTrackAApprovalLevel(
  cost: number | null | undefined,
  policy: { trackAApprovalEur250k: number; trackAApprovalEur1m: number }
) {
  const normalized = cost ?? 0;
  if (normalized <= policy.trackAApprovalEur250k) return "epc_director";
  if (normalized <= policy.trackAApprovalEur1m) return "project_director";
  return "change_order_escalation";
}

export function deriveCycleMilestones(gateDate?: Date | null) {
  if (!gateDate) {
    return {
      gateDate: null as string | null,
      tMinus6At: null as Date | null,
      tMinus5At: null as Date | null,
      tMinus4At: null as Date | null,
      tMinus3At: null as Date | null,
      tMinus2At: null as Date | null,
      tMinus1At: null as Date | null,
    };
  }

  const tMinus = (days: number) => {
    const value = new Date(gateDate);
    value.setDate(value.getDate() - days);
    return value;
  };

  return {
    gateDate: gateDate.toISOString().slice(0, 10),
    tMinus6At: tMinus(42),
    tMinus5At: tMinus(35),
    tMinus4At: tMinus(28),
    tMinus3At: tMinus(21),
    tMinus2At: tMinus(14),
    tMinus1At: tMinus(7),
  };
}
