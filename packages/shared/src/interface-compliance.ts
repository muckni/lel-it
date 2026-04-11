import { addDays, normalizeDateOnly } from "./deadlines";
import { INTERFACE_CASE_STATES, type InterfaceLifecycleState } from "./enums";

export type SlaPolicy = {
  baseDays: number;
  employerForwardingExtensionDays: number;
};

export const DEFAULT_SLA_POLICY: SlaPolicy = {
  baseDays: 14,
  employerForwardingExtensionDays: 7,
};

export const MATRIX_SCOPE_COLUMNS = [
  "spec",
  "des",
  "sup",
  "on_a",
  "on_t",
  "on_c",
  "off_t",
  "off_i",
  "off_c",
] as const;

export type MatrixScopeAllocation = Partial<
  Record<(typeof MATRIX_SCOPE_COLUMNS)[number], string>
>;

const STATE_ORDER: InterfaceLifecycleState[] = [
  "draft_dir",
  "employer_validated",
  "forwarded",
  "answered",
  "reviewed",
  "accepted",
  "closed",
];

export function isValidLifecycleTransition(
  fromState: InterfaceLifecycleState,
  toState: InterfaceLifecycleState
): boolean {
  if (toState === "reopened") return fromState === "closed";
  if (fromState === "reopened") return toState === "forwarded";
  const fromIndex = STATE_ORDER.indexOf(fromState);
  const toIndex = STATE_ORDER.indexOf(toState);
  return fromIndex >= 0 && toIndex === fromIndex + 1;
}

export function computeDefaultSlaDueAt(
  createdAt: Date | string,
  policy: SlaPolicy = DEFAULT_SLA_POLICY
): Date {
  return addDays(normalizeDateOnly(createdAt), policy.baseDays);
}
