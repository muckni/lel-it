import { TRPCError } from "@trpc/server";
import {
  db,
  interfaceCaseEvents,
  interfaceCases,
  organizations,
  projectMemberOrganizationRoles,
  projectMembers,
} from "@owit/db";
import { and, eq } from "drizzle-orm";
import {
  DEFAULT_SLA_POLICY,
  computeDefaultSlaDueAt,
  isValidLifecycleTransition,
  type InterfaceLifecycleState,
  type InterfacePartyRole,
  type SlaPolicy,
} from "@owit/shared";

export async function getProjectMemberByUser(
  projectId: string,
  userId: string
) {
  return db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
  });
}

export async function requireInterfaceRole(
  projectMemberId: string,
  roles: InterfacePartyRole[]
): Promise<void> {
  const row = await db.query.projectMemberOrganizationRoles.findFirst({
    where: eq(projectMemberOrganizationRoles.projectMemberId, projectMemberId),
    columns: { interfaceRole: true },
  });

  if (!row || !roles.includes(row.interfaceRole as InterfacePartyRole)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Requires one of interface roles: ${roles.join(", ")}`,
    });
  }
}

export function assertTransitionAllowed(
  fromState: InterfaceLifecycleState,
  toState: InterfaceLifecycleState
): void {
  if (!isValidLifecycleTransition(fromState, toState)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid lifecycle transition: ${fromState} -> ${toState}`,
    });
  }
}

export function resolveSlaDueAt(
  createdAt: Date,
  policy: Partial<SlaPolicy> | undefined,
  withEmployerForwardingExtension: boolean
): Date {
  const effectivePolicy: SlaPolicy = {
    baseDays: policy?.baseDays ?? DEFAULT_SLA_POLICY.baseDays,
    employerForwardingExtensionDays:
      policy?.employerForwardingExtensionDays ??
      DEFAULT_SLA_POLICY.employerForwardingExtensionDays,
  };

  const base = computeDefaultSlaDueAt(createdAt, effectivePolicy);
  if (!withEmployerForwardingExtension) return base;

  const extended = new Date(base);
  extended.setDate(base.getDate() + effectivePolicy.employerForwardingExtensionDays);
  return extended;
}

export async function isContractorToContractorCase(caseId: string): Promise<boolean> {
  const item = await db.query.interfaceCases.findFirst({
    where: eq(interfaceCases.id, caseId),
    columns: {
      requestingOrganizationId: true,
      providingOrganizationId: true,
    },
  });
  if (!item?.requestingOrganizationId || !item.providingOrganizationId) return false;

  const [reqOrg, provOrg] = await Promise.all([
    db.query.organizations.findFirst({
      where: eq(organizations.id, item.requestingOrganizationId),
      columns: { type: true },
    }),
    db.query.organizations.findFirst({
      where: eq(organizations.id, item.providingOrganizationId),
      columns: { type: true },
    }),
  ]);

  const req = reqOrg?.type;
  const prov = provOrg?.type;
  const contractorLike = (value?: string) =>
    value === "contractor" || value === "subcontractor";

  return contractorLike(req) && contractorLike(prov);
}

export async function appendInterfaceCaseEvent(input: {
  caseId: string;
  projectId: string;
  eventType:
    | "state_changed"
    | "comment_added"
    | "assignment_changed"
    | "sla_changed"
    | "employer_approval_granted"
    | "document_attached"
    | "closed"
    | "reopened";
  actorUserId: string;
  actorMemberId?: string | null;
  fromState?: InterfaceLifecycleState | null;
  toState?: InterfaceLifecycleState | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
}) {
  await db.insert(interfaceCaseEvents).values({
    caseId: input.caseId,
    projectId: input.projectId,
    eventType: input.eventType,
    actorUserId: input.actorUserId,
    actorMemberId: input.actorMemberId ?? null,
    fromState: input.fromState ?? null,
    toState: input.toState ?? null,
    summary: input.summary ?? null,
    payload: input.payload ?? null,
  });
}
