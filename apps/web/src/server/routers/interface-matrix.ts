import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  interfaceCases,
  interfaceMeetingAttendance,
  interfaceMeetings,
  interfaceMatrixRevisions,
  interfaceMatrixRows,
  organizations,
} from "@owit/db";
import { assertMember } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  appendInterfaceCaseEvent,
  getProjectMemberByUser,
  requireInterfaceRole,
} from "@/server/lib/interface-compliance";

async function requireMatrixManager(projectId: string, userId: string) {
  await assertMember(userId, projectId);
  const member = await getProjectMemberByUser(projectId, userId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  await requireInterfaceRole(member.id, [
    "employer_interface_manager",
    "contractor_interface_manager",
    "interface_coordinator",
  ]);
  return member;
}

export const interfaceMatrixRouter = createTRPCRouter({
  createRevision: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        revisionLabel: z.string().min(1).max(64),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireMatrixManager(input.projectId, ctx.user.id);
      const [created] = await db
        .insert(interfaceMatrixRevisions)
        .values({
          projectId: input.projectId,
          revisionLabel: input.revisionLabel,
          createdBy: ctx.user.id,
        })
        .returning();
      return created;
    }),

  publishRevision: protectedProcedure
    .input(z.object({ revisionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, input.revisionId),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await requireMatrixManager(revision.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, ["employer_interface_manager"]);

      const [updated] = await db
        .update(interfaceMatrixRevisions)
        .set({ publishedAt: new Date() })
        .where(eq(interfaceMatrixRevisions.id, revision.id))
        .returning();
      return updated;
    }),

  importRows: protectedProcedure
    .input(
      z.object({
        revisionId: z.string().uuid(),
        rows: z.array(
          z.object({
            interfaceId: z.string().min(1).max(64),
            groupCode: z.string().max(64).optional(),
            interfaceComponent: z.string().min(1).max(255),
            description: z.string().optional(),
            specOrgId: z.string().uuid().optional(),
            desOrgId: z.string().uuid().optional(),
            supOrgId: z.string().uuid().optional(),
            onAOrgId: z.string().uuid().optional(),
            onTOrgId: z.string().uuid().optional(),
            onCOrgId: z.string().uuid().optional(),
            offTOrgId: z.string().uuid().optional(),
            offIOrgId: z.string().uuid().optional(),
            offCOrgId: z.string().uuid().optional(),
            responsibleOrganizationId: z.string().uuid().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, input.revisionId),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND" });
      await requireMatrixManager(revision.projectId, ctx.user.id);

      for (const row of input.rows) {
        // eslint-disable-next-line no-await-in-loop
        await db
          .insert(interfaceMatrixRows)
          .values({
            projectId: revision.projectId,
            revisionId: revision.id,
            interfaceId: row.interfaceId,
            groupCode: row.groupCode ?? null,
            interfaceComponent: row.interfaceComponent,
            description: row.description ?? null,
            specOrgId: row.specOrgId ?? null,
            desOrgId: row.desOrgId ?? null,
            supOrgId: row.supOrgId ?? null,
            onAOrgId: row.onAOrgId ?? null,
            onTOrgId: row.onTOrgId ?? null,
            onCOrgId: row.onCOrgId ?? null,
            offTOrgId: row.offTOrgId ?? null,
            offIOrgId: row.offIOrgId ?? null,
            offCOrgId: row.offCOrgId ?? null,
            responsibleOrganizationId: row.responsibleOrganizationId ?? null,
          })
          .onConflictDoNothing();
      }

      return { imported: input.rows.length };
    }),

  listRows: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        revisionId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const where = input.revisionId
        ? and(
            eq(interfaceMatrixRows.projectId, input.projectId),
            eq(interfaceMatrixRows.revisionId, input.revisionId)
          )
        : eq(interfaceMatrixRows.projectId, input.projectId);

      return db.query.interfaceMatrixRows.findMany({
        where,
        orderBy: [desc(interfaceMatrixRows.createdAt)],
      });
    }),

  listStakeholders: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.organizations.findMany({
        where: eq(organizations.projectId, input.projectId),
        orderBy: [desc(organizations.createdAt)],
      });
    }),

  createStakeholder: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().min(1).max(255),
        type: z.enum(["employer", "contractor", "subcontractor"]),
        abbreviation: z.string().max(32).optional(),
        color: z.string().max(20).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireMatrixManager(input.projectId, ctx.user.id);
      const [created] = await db
        .insert(organizations)
        .values({
          projectId: input.projectId,
          name: input.name,
          type: input.type,
          abbreviation: input.abbreviation ?? null,
          color: input.color ?? null,
        })
        .returning();
      return created;
    }),

  createMeeting: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(255),
        meetingType: z.enum(["kickoff", "regular", "adhoc"]).default("regular"),
        startsAt: z.string(),
        agenda: z.string().optional(),
        attendeeMemberIds: z.array(z.string().uuid()).optional().default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireMatrixManager(input.projectId, ctx.user.id);
      const [meeting] = await db
        .insert(interfaceMeetings)
        .values({
          projectId: input.projectId,
          title: input.title,
          meetingType: input.meetingType,
          startsAt: new Date(input.startsAt),
          agenda: input.agenda ?? null,
          createdBy: ctx.user.id,
        })
        .returning();

      if (input.attendeeMemberIds.length > 0) {
        await db.insert(interfaceMeetingAttendance).values(
          input.attendeeMemberIds.map((memberId) => ({
            meetingId: meeting.id,
            projectMemberId: memberId,
            attended: false,
          }))
        );
      }

      return meeting;
    }),

  listMeetings: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.interfaceMeetings.findMany({
        where: eq(interfaceMeetings.projectId, input.projectId),
        orderBy: [desc(interfaceMeetings.startsAt)],
      });
    }),

  markAttendance: protectedProcedure
    .input(
      z.object({
        meetingId: z.string().uuid(),
        projectMemberId: z.string().uuid(),
        attended: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const meeting = await db.query.interfaceMeetings.findFirst({
        where: eq(interfaceMeetings.id, input.meetingId),
      });
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });
      await requireMatrixManager(meeting.projectId, ctx.user.id);

      const [row] = await db
        .insert(interfaceMeetingAttendance)
        .values({
          meetingId: input.meetingId,
          projectMemberId: input.projectMemberId,
          attended: input.attended,
        })
        .onConflictDoUpdate({
          target: [
            interfaceMeetingAttendance.meetingId,
            interfaceMeetingAttendance.projectMemberId,
          ],
          set: { attended: input.attended },
        })
        .returning();
      return row;
    }),

  syncRegister: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        revisionId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const member = await requireMatrixManager(input.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, ["employer_interface_manager"]);

      const rows = await db.execute(sql`
        SELECT id::text, interface_component, description
        FROM interface_matrix_rows
        WHERE project_id = ${input.projectId}
          ${input.revisionId ? sql`AND revision_id = ${input.revisionId}` : sql``}
      `);

      const existing = await db.query.interfaceCases.findMany({
        where: and(
          eq(interfaceCases.projectId, input.projectId),
          eq(interfaceCases.sourceEntityType, "matrix_row")
        ),
        columns: { sourceEntityId: true },
      });
      const existingSet = new Set(existing.map((x) => x.sourceEntityId));

      let created = 0;
      for (const row of rows as unknown as Array<{ id: string; interface_component: string; description: string | null }>) {
        if (existingSet.has(row.id)) continue;
        // eslint-disable-next-line no-await-in-loop
        const [createdCase] = await db
          .insert(interfaceCases)
          .values({
            projectId: input.projectId,
            title: row.interface_component,
            description: row.description ?? null,
            sourceEntityType: "matrix_row",
            sourceEntityId: row.id,
            currentState: "draft_dir",
            employerGateRequired: true,
            createdBy: ctx.user.id,
          })
          .returning();
        created += 1;

        // eslint-disable-next-line no-await-in-loop
        await appendInterfaceCaseEvent({
          caseId: createdCase.id,
          projectId: input.projectId,
          eventType: "state_changed",
          actorUserId: ctx.user.id,
          actorMemberId: member.id,
          toState: "draft_dir",
          summary: "Created from matrix row synchronization",
        });
      }

      return { created };
    }),
});
