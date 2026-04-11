import { randomUUID } from "crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNotNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, interfaceCases, interfacePoints, interfaceQueries, organizations } from "@owit/db";
import {
  INTERFACE_CASE_STATES,
  INTERFACE_PARTY_ROLES,
  type InterfaceLifecycleState,
} from "@owit/shared";
import { assertMember } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  appendInterfaceCaseEvent,
  assertTransitionAllowed,
  getProjectMemberByUser,
  isContractorToContractorCase,
  requireInterfaceRole,
  resolveSlaDueAt,
} from "@/server/lib/interface-compliance";

const lifecycleEnum = z.enum(INTERFACE_CASE_STATES);

async function requireProjectMember(projectId: string, userId: string) {
  const member = await getProjectMemberByUser(projectId, userId);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a project member" });
  }
  return member;
}

async function requireEmployerRole(projectId: string, userId: string) {
  const member = await requireProjectMember(projectId, userId);
  await requireInterfaceRole(member.id, ["employer_interface_manager"]);
  return member;
}

async function transitionCase(input: {
  caseId: string;
  actorUserId: string;
  actorMemberId: string;
  nextState: InterfaceLifecycleState;
  summary?: string;
  projectId: string;
  allowReopenedForward?: boolean;
  mutate?: Record<string, unknown>;
}) {
  const existing = await db.query.interfaceCases.findFirst({
    where: eq(interfaceCases.id, input.caseId),
  });
  if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });

  if (
    !(existing.currentState === "reopened" && input.nextState === "forwarded" && input.allowReopenedForward)
  ) {
    assertTransitionAllowed(existing.currentState as InterfaceLifecycleState, input.nextState);
  }

  const [updated] = await db
    .update(interfaceCases)
    .set({
      currentState: input.nextState,
      updatedAt: new Date(),
      ...(input.mutate ?? {}),
    })
    .where(eq(interfaceCases.id, input.caseId))
    .returning();

  await appendInterfaceCaseEvent({
    caseId: input.caseId,
    projectId: input.projectId,
    eventType:
      input.nextState === "closed"
        ? "closed"
        : input.nextState === "reopened"
          ? "reopened"
          : "state_changed",
    actorUserId: input.actorUserId,
    actorMemberId: input.actorMemberId,
    fromState: existing.currentState as InterfaceLifecycleState,
    toState: input.nextState,
    summary: input.summary ?? null,
  });

  return updated;
}

export const interfaceCaseRouter = createTRPCRouter({
  createDir: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        sourceEntityType: z.string().optional(),
        sourceEntityId: z.string().uuid().optional(),
        requestingOrganizationId: z.string().uuid().optional(),
        providingOrganizationId: z.string().uuid().optional(),
        responsibleOrganizationId: z.string().uuid().optional(),
        requestingPartyMemberId: z.string().uuid().optional(),
        providingPartyMemberId: z.string().uuid().optional(),
        responsiblePartyMemberId: z.string().uuid().optional(),
        employerGateRequired: z.boolean().optional().default(true),
        dueDate: z.string().optional(),
        slaPolicy: z
          .object({
            baseDays: z.number().int().min(1).max(180).optional(),
            employerForwardingExtensionDays: z.number().int().min(0).max(60).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const member = await requireProjectMember(input.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, [
        "employer_interface_manager",
        "contractor_interface_manager",
        "interface_coordinator",
        "requesting_party",
      ]);

      let withExtension = false;
      if (input.requestingOrganizationId && input.providingOrganizationId) {
        const [reqOrg, provOrg] = await Promise.all([
          db.query.organizations.findFirst({
            where: eq(organizations.id, input.requestingOrganizationId),
            columns: { type: true },
          }),
          db.query.organizations.findFirst({
            where: eq(organizations.id, input.providingOrganizationId),
            columns: { type: true },
          }),
        ]);
        const contractorLike = (value?: string) =>
          value === "contractor" || value === "subcontractor";
        withExtension = contractorLike(reqOrg?.type) && contractorLike(provOrg?.type);
      }

      const now = new Date();
      const slaDueAt = resolveSlaDueAt(now, input.slaPolicy, withExtension);

      const [created] = await db
        .insert(interfaceCases)
        .values({
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          sourceEntityType: input.sourceEntityType ?? null,
          sourceEntityId: input.sourceEntityId ?? null,
          requestingOrganizationId: input.requestingOrganizationId ?? null,
          providingOrganizationId: input.providingOrganizationId ?? null,
          responsibleOrganizationId: input.responsibleOrganizationId ?? null,
          requestingPartyMemberId: input.requestingPartyMemberId ?? member.id,
          providingPartyMemberId: input.providingPartyMemberId ?? null,
          responsiblePartyMemberId: input.responsiblePartyMemberId ?? null,
          employerGateRequired: input.employerGateRequired,
          dueDate: input.dueDate || null,
          slaDueAt,
          createdBy: ctx.user.id,
        })
        .returning();

      await appendInterfaceCaseEvent({
        caseId: created.id,
        projectId: created.projectId,
        eventType: "state_changed",
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        fromState: null,
        toState: "draft_dir",
        summary: "DIR created",
      });

      return created;
    }),

  validateByEmployer: protectedProcedure
    .input(z.object({ caseId: z.string().uuid(), summary: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });

      const member = await requireEmployerRole(item.projectId, ctx.user.id);

      return transitionCase({
        caseId: item.id,
        projectId: item.projectId,
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        nextState: "employer_validated",
        summary: input.summary ?? "Validated by employer",
        mutate: { employerValidatedAt: new Date() },
      });
    }),

  forward: protectedProcedure
    .input(z.object({ caseId: z.string().uuid(), summary: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });

      await assertMember(ctx.user.id, item.projectId);
      const member = await requireProjectMember(item.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, [
        "employer_interface_manager",
        "contractor_interface_manager",
        "interface_coordinator",
      ]);

      const c2c = await isContractorToContractorCase(item.id);
      const mutate: Record<string, unknown> = {};

      if (c2c && item.employerGateRequired && !item.employerApprovalId) {
        await requireInterfaceRole(member.id, ["employer_interface_manager"]);
        mutate.employerApprovalId = randomUUID();
        await appendInterfaceCaseEvent({
          caseId: item.id,
          projectId: item.projectId,
          eventType: "employer_approval_granted",
          actorUserId: ctx.user.id,
          actorMemberId: member.id,
          summary: "Employer approved contractor-to-contractor forwarding",
        });
      }

      return transitionCase({
        caseId: item.id,
        projectId: item.projectId,
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        nextState: "forwarded",
        allowReopenedForward: true,
        summary: input.summary ?? "Forwarded to providing party",
        mutate,
      });
    }),

  answerDir: protectedProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        answer: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });

      await assertMember(ctx.user.id, item.projectId);
      const member = await requireProjectMember(item.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, [
        "providing_party",
        "contractor_interface_manager",
        "interface_coordinator",
      ]);

      const c2c = await isContractorToContractorCase(item.id);
      if (c2c && item.employerGateRequired && !item.employerApprovalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Employer approval required before contractor-to-contractor response",
        });
      }

      const updated = await transitionCase({
        caseId: item.id,
        projectId: item.projectId,
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        nextState: "answered",
        summary: "DIR answered",
      });

      await appendInterfaceCaseEvent({
        caseId: item.id,
        projectId: item.projectId,
        eventType: "comment_added",
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        summary: input.answer.slice(0, 500),
      });

      return updated;
    }),

  reviewAnswer: protectedProcedure
    .input(z.object({ caseId: z.string().uuid(), summary: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });

      await assertMember(ctx.user.id, item.projectId);
      const member = await requireProjectMember(item.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, [
        "requesting_party",
        "contractor_interface_manager",
        "interface_coordinator",
      ]);

      return transitionCase({
        caseId: item.id,
        projectId: item.projectId,
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        nextState: "reviewed",
        summary: input.summary ?? "Answer reviewed",
      });
    }),

  acceptAnswer: protectedProcedure
    .input(z.object({ caseId: z.string().uuid(), summary: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });

      await assertMember(ctx.user.id, item.projectId);
      const member = await requireProjectMember(item.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, [
        "requesting_party",
        "employer_interface_manager",
      ]);

      return transitionCase({
        caseId: item.id,
        projectId: item.projectId,
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        nextState: "accepted",
        summary: input.summary ?? "Answer accepted",
        mutate: { acceptedAt: new Date() },
      });
    }),

  closeCase: protectedProcedure
    .input(z.object({ caseId: z.string().uuid(), summary: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });
      const member = await requireEmployerRole(item.projectId, ctx.user.id);

      return transitionCase({
        caseId: item.id,
        projectId: item.projectId,
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        nextState: "closed",
        summary: input.summary ?? "Closed by employer",
        mutate: { closedAt: new Date() },
      });
    }),

  reopenCase: protectedProcedure
    .input(z.object({ caseId: z.string().uuid(), summary: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });
      const member = await requireEmployerRole(item.projectId, ctx.user.id);

      return transitionCase({
        caseId: item.id,
        projectId: item.projectId,
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        nextState: "reopened",
        summary: input.summary ?? "Reopened by employer",
        mutate: { closedAt: null, acceptedAt: null },
      });
    }),

  assignParties: protectedProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        requestingOrganizationId: z.string().uuid().optional(),
        providingOrganizationId: z.string().uuid().optional(),
        responsibleOrganizationId: z.string().uuid().optional(),
        requestingPartyMemberId: z.string().uuid().optional(),
        providingPartyMemberId: z.string().uuid().optional(),
        responsiblePartyMemberId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });

      await assertMember(ctx.user.id, item.projectId);
      const member = await requireProjectMember(item.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, [
        "employer_interface_manager",
        "contractor_interface_manager",
      ]);

      const [updated] = await db
        .update(interfaceCases)
        .set({
          requestingOrganizationId: input.requestingOrganizationId ?? item.requestingOrganizationId,
          providingOrganizationId: input.providingOrganizationId ?? item.providingOrganizationId,
          responsibleOrganizationId:
            input.responsibleOrganizationId ?? item.responsibleOrganizationId,
          requestingPartyMemberId:
            input.requestingPartyMemberId ?? item.requestingPartyMemberId,
          providingPartyMemberId: input.providingPartyMemberId ?? item.providingPartyMemberId,
          responsiblePartyMemberId:
            input.responsiblePartyMemberId ?? item.responsiblePartyMemberId,
          updatedAt: new Date(),
        })
        .where(eq(interfaceCases.id, item.id))
        .returning();

      await appendInterfaceCaseEvent({
        caseId: item.id,
        projectId: item.projectId,
        eventType: "assignment_changed",
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        summary: "Parties updated",
      });

      return updated;
    }),

  setSla: protectedProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        slaDueAt: z.string(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });

      await assertMember(ctx.user.id, item.projectId);
      const member = await requireProjectMember(item.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, [
        "employer_interface_manager",
        "contractor_interface_manager",
      ]);

      const [updated] = await db
        .update(interfaceCases)
        .set({ slaDueAt: new Date(input.slaDueAt), updatedAt: new Date() })
        .where(eq(interfaceCases.id, item.id))
        .returning();

      await appendInterfaceCaseEvent({
        caseId: item.id,
        projectId: item.projectId,
        eventType: "sla_changed",
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        summary: input.reason ?? "SLA updated",
      });

      return updated;
    }),

  addComment: protectedProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });
      await assertMember(ctx.user.id, item.projectId);
      const member = await requireProjectMember(item.projectId, ctx.user.id);

      const c2c = await isContractorToContractorCase(item.id);
      if (c2c && item.employerGateRequired && !item.employerApprovalId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Employer approval required before contractor-to-contractor comments",
        });
      }

      await appendInterfaceCaseEvent({
        caseId: item.id,
        projectId: item.projectId,
        eventType: "comment_added",
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        summary: input.content.slice(0, 500),
      });

      return { success: true };
    }),

  attachDocument: protectedProcedure
    .input(
      z.object({
        caseId: z.string().uuid(),
        attachmentId: z.string().uuid(),
        commentSheet: z.boolean().optional().default(false),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });
      await assertMember(ctx.user.id, item.projectId);
      const member = await requireProjectMember(item.projectId, ctx.user.id);

      await appendInterfaceCaseEvent({
        caseId: item.id,
        projectId: item.projectId,
        eventType: "document_attached",
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        summary: input.notes ?? "Interface correspondence document attached",
        payload: {
          attachmentId: input.attachmentId,
          commentSheet: input.commentSheet,
        },
      });

      return { success: true };
    }),

  listCases: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        state: lifecycleEnum.optional(),
        organizationId: z.string().uuid().optional(),
        onlyOpen: z.boolean().optional().default(false),
        limit: z.number().int().min(1).max(500).default(200),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const rows = (await db.execute(sql`
        SELECT *
        FROM interface_cases
        WHERE project_id = ${input.projectId}
          ${input.state ? sql`AND current_state = ${input.state}` : sql``}
          ${input.organizationId
            ? sql`AND (requesting_organization_id = ${input.organizationId}
                OR providing_organization_id = ${input.organizationId}
                OR responsible_organization_id = ${input.organizationId})`
            : sql``}
          ${input.onlyOpen ? sql`AND closed_at IS NULL` : sql``}
        ORDER BY updated_at DESC
        LIMIT ${input.limit}
      `)) as unknown as Array<Record<string, unknown>>;
      return rows;
    }),

  getTimeline: protectedProcedure
    .input(z.object({ caseId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const item = await db.query.interfaceCases.findFirst({
        where: eq(interfaceCases.id, input.caseId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Interface case not found" });
      await assertMember(ctx.user.id, item.projectId);

      // fallback query due relation-free event access
      const timeline = await db.execute(sql`
        SELECT *
        FROM interface_case_events
        WHERE case_id = ${input.caseId}
        ORDER BY created_at DESC
      `);

      return {
        case: item,
        events: (timeline as unknown as any[]) ?? [],
      };
    }),

  bulkMigrateFromLegacy: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        dryRun: z.boolean().optional().default(true),
        limit: z.number().int().min(1).max(1000).default(250),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const member = await requireEmployerRole(input.projectId, ctx.user.id);

      const points = await db.execute(sql`
        SELECT
          ip.id::text AS id,
          ip.title AS title,
          ip.description AS description,
          ip.due_date::text AS due_date
        FROM interface_points ip
        INNER JOIN interface_agreements ia ON ia.id = ip.agreement_id
        INNER JOIN interface_registers ir ON ir.id = ia.register_id
        WHERE ir.project_id = ${input.projectId}
        LIMIT ${input.limit}
      `);

      const iqs = await db.execute(sql`
        SELECT
          iq.id::text AS id,
          iq.subject AS title,
          iq.description AS description,
          iq.due_date::text AS due_date
        FROM interface_queries iq
        INNER JOIN interface_points ip ON ip.id = iq.interface_point_id
        INNER JOIN interface_agreements ia ON ia.id = ip.agreement_id
        INNER JOIN interface_registers ir ON ir.id = ia.register_id
        WHERE ir.project_id = ${input.projectId}
        LIMIT ${input.limit}
      `);

      const candidates = [
        ...(points as unknown as Array<{ id: string; title: string; description: string | null; due_date: string | null }>).map((p) => ({
          sourceEntityType: "interface_point",
          sourceEntityId: p.id,
          title: p.title,
          description: p.description,
          dueDate: p.due_date,
        })),
        ...(iqs as unknown as Array<{ id: string; title: string; description: string | null; due_date: string | null }>).map((q) => ({
          sourceEntityType: "iq",
          sourceEntityId: q.id,
          title: q.title,
          description: q.description,
          dueDate: q.due_date,
        })),
      ];

      const existing = await db.query.interfaceCases.findMany({
        where: and(
          eq(interfaceCases.projectId, input.projectId),
          or(
            eq(interfaceCases.sourceEntityType, "interface_point"),
            eq(interfaceCases.sourceEntityType, "iq")
          )!
        ),
        columns: {
          sourceEntityType: true,
          sourceEntityId: true,
        },
      });
      const existingSet = new Set(
        existing.map((row) => `${row.sourceEntityType}:${row.sourceEntityId}`)
      );

      const toCreate = candidates.filter(
        (item) => !existingSet.has(`${item.sourceEntityType}:${item.sourceEntityId}`)
      );

      if (!input.dryRun && toCreate.length > 0) {
        for (const legacy of toCreate) {
          // eslint-disable-next-line no-await-in-loop
          const [created] = await db
            .insert(interfaceCases)
            .values({
              projectId: input.projectId,
              title: legacy.title,
              description: legacy.description ?? null,
              sourceEntityType: legacy.sourceEntityType,
              sourceEntityId: legacy.sourceEntityId,
              dueDate: legacy.dueDate,
              employerGateRequired: true,
              currentState: "draft_dir",
              createdBy: ctx.user.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();

          // eslint-disable-next-line no-await-in-loop
          await appendInterfaceCaseEvent({
            caseId: created.id,
            projectId: input.projectId,
            eventType: "state_changed",
            actorUserId: ctx.user.id,
            actorMemberId: member.id,
            toState: "draft_dir",
            summary: `Migrated from ${legacy.sourceEntityType}`,
          });
        }
      }

      return {
        dryRun: input.dryRun,
        totalCandidates: candidates.length,
        toCreate: toCreate.length,
      };
    }),
});
