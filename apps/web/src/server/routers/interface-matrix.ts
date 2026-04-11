import { createHash } from "crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  db,
  interfaceCases,
  interfaceMeetingAttendance,
  interfaceMeetings,
  interfaceMatrixAllocations,
  interfaceMatrixPacks,
  interfaceMatrixRevisions,
  interfaceMatrixRows,
  organizations,
} from "@owit/db";
import { MATRIX_SCOPE_COLUMNS } from "@owit/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMember } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  appendInterfaceCaseEvent,
  getProjectMemberByUser,
  requireInterfaceRole,
} from "@/server/lib/interface-compliance";

const PHASE_COLUMNS = MATRIX_SCOPE_COLUMNS;
const phaseColumnSchema = z.enum(PHASE_COLUMNS);

function requireUuid(input: string | undefined): string {
  if (!input) throw new TRPCError({ code: "BAD_REQUEST", message: "Missing uuid value" });
  return input;
}

function parseDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

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

function splitParticipants(raw: string): Array<{ code: string; isResponsible: boolean; isNotRelevant: boolean }> {
  const value = String(raw ?? "").trim();
  if (!value) return [];

  return value
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const normalized = part.replace(/\s+/g, " ").trim();
      const isNotRelevant = normalized.toLowerCase() === "n.r." || normalized.toLowerCase() === "n.r";
      if (isNotRelevant) {
        return { code: "n.r.", isResponsible: false, isNotRelevant: true };
      }
      const isResponsible = /\(r\)/i.test(normalized);
      const code = normalized.replace(/\(r\)/gi, "").trim();
      return {
        code,
        isResponsible,
        isNotRelevant: false,
      };
    });
}

function buildParticipantsDisplay(
  entries: Array<{ code: string; isResponsible: boolean; isNotRelevant: boolean }>
): string {
  if (entries.length === 0) return "";
  if (entries.some((entry) => entry.isNotRelevant)) return "n.r.";
  return entries
    .map((entry) => `${entry.code}${entry.isResponsible ? " (R)" : ""}`)
    .join("\n");
}

function generateSimplePdf(title: string, lines: string[]): Buffer {
  const safeText = [title, "", ...lines]
    .join("\n")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  const content = `BT /F1 10 Tf 50 760 Td (${safeText.replace(/\n/g, ") Tj T* (")}) Tj ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(pdf, "utf-8");
}

export const interfaceMatrixRouter = createTRPCRouter({
  createRevision: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        revisionLabel: z.string().min(1).max(64),
        sourceDocumentRef: z.string().max(255).optional(),
        issuedFor: z.string().max(255).optional(),
        preparedBy: z.string().max(255).optional(),
        checkedBy: z.string().max(255).optional(),
        approvedBy: z.string().max(255).optional(),
        approvedAt: z.string().optional(),
        effectiveDate: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireMatrixManager(input.projectId, ctx.user.id);
      const [created] = await db
        .insert(interfaceMatrixRevisions)
        .values({
          projectId: input.projectId,
          revisionLabel: input.revisionLabel,
          sourceDocumentRef: input.sourceDocumentRef ?? null,
          issuedFor: input.issuedFor ?? null,
          preparedBy: input.preparedBy ?? null,
          checkedBy: input.checkedBy ?? null,
          approvedBy: input.approvedBy ?? null,
          approvedAt: input.approvedAt ? new Date(input.approvedAt) : null,
          effectiveDate: parseDateOnly(input.effectiveDate),
          createdBy: ctx.user.id,
        })
        .returning();
      return created;
    }),

  listRevisions: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.interfaceMatrixRevisions.findMany({
        where: eq(interfaceMatrixRevisions.projectId, input.projectId),
        orderBy: [desc(interfaceMatrixRevisions.createdAt)],
      });
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
        .set({
          publishedAt: new Date(),
          approvedAt: revision.approvedAt ?? new Date(),
          approvedBy: revision.approvedBy ?? "Employer",
        })
        .where(eq(interfaceMatrixRevisions.id, revision.id))
        .returning();
      return updated;
    }),

  lockRevision: protectedProcedure
    .input(z.object({ revisionId: z.string().uuid(), isLocked: z.boolean().default(true) }))
    .mutation(async ({ input, ctx }) => {
      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, input.revisionId),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await requireMatrixManager(revision.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, ["employer_interface_manager"]);

      const [updated] = await db
        .update(interfaceMatrixRevisions)
        .set({ isLocked: input.isLocked })
        .where(eq(interfaceMatrixRevisions.id, revision.id))
        .returning();
      return updated;
    }),

  upsertRow: protectedProcedure
    .input(
      z.object({
        revisionId: z.string().uuid(),
        rowId: z.string().uuid().optional(),
        interfaceId: z.string().min(1).max(64),
        emplInternalRevision: z.number().int().optional(),
        groupCode: z.string().max(64).optional(),
        groupName: z.string().max(255).optional(),
        interfaceComponent: z.string().min(1).max(255),
        description: z.string().optional(),
        displayOrder: z.number().int().optional(),
        parentRowId: z.string().uuid().optional(),
        isActive: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, input.revisionId),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND" });
      if (revision.isLocked) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Revision is locked" });
      }

      await requireMatrixManager(revision.projectId, ctx.user.id);

      if (input.rowId) {
        const [updated] = await db
          .update(interfaceMatrixRows)
          .set({
            interfaceId: input.interfaceId,
            emplInternalRevision: input.emplInternalRevision ?? null,
            groupCode: input.groupCode ?? null,
            groupName: input.groupName ?? null,
            interfaceComponent: input.interfaceComponent,
            description: input.description ?? null,
            displayOrder: input.displayOrder ?? null,
            parentRowId: input.parentRowId ?? null,
            isActive: input.isActive,
          })
          .where(eq(interfaceMatrixRows.id, input.rowId))
          .returning();
        return updated;
      }

      const [created] = await db
        .insert(interfaceMatrixRows)
        .values({
          projectId: revision.projectId,
          revisionId: revision.id,
          interfaceId: input.interfaceId,
          emplInternalRevision: input.emplInternalRevision ?? null,
          groupCode: input.groupCode ?? null,
          groupName: input.groupName ?? null,
          interfaceComponent: input.interfaceComponent,
          description: input.description ?? null,
          displayOrder: input.displayOrder ?? null,
          parentRowId: input.parentRowId ?? null,
          isActive: input.isActive,
        })
        .onConflictDoUpdate({
          target: [interfaceMatrixRows.projectId, interfaceMatrixRows.revisionId, interfaceMatrixRows.interfaceId],
          set: {
            emplInternalRevision: input.emplInternalRevision ?? null,
            groupCode: input.groupCode ?? null,
            groupName: input.groupName ?? null,
            interfaceComponent: input.interfaceComponent,
            description: input.description ?? null,
            displayOrder: input.displayOrder ?? null,
            parentRowId: input.parentRowId ?? null,
            isActive: input.isActive,
          },
        })
        .returning();
      return created;
    }),

  upsertAllocations: protectedProcedure
    .input(
      z.object({
        rowId: z.string().uuid(),
        allocations: z.array(
          z.object({
            phaseColumn: phaseColumnSchema,
            organizationId: z.string().uuid().nullable().optional(),
            isResponsible: z.boolean().optional().default(false),
            isNotRelevant: z.boolean().optional().default(false),
            sortOrder: z.number().int().optional().default(0),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const row = await db.query.interfaceMatrixRows.findFirst({
        where: eq(interfaceMatrixRows.id, input.rowId),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, row.revisionId),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND" });
      if (revision.isLocked) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Revision is locked" });
      }

      await requireMatrixManager(row.projectId, ctx.user.id);

      for (const phase of PHASE_COLUMNS) {
        const responsibleCount = input.allocations.filter(
          (entry) => entry.phaseColumn === phase && entry.isResponsible && !entry.isNotRelevant
        ).length;
        if (responsibleCount > 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Only one responsible party is allowed for ${phase}`,
          });
        }
      }

      await db.delete(interfaceMatrixAllocations).where(eq(interfaceMatrixAllocations.rowId, input.rowId));

      if (input.allocations.length > 0) {
        await db.insert(interfaceMatrixAllocations).values(
          input.allocations.map((entry) => ({
            projectId: row.projectId,
            rowId: row.id,
            phaseColumn: entry.phaseColumn,
            organizationId: entry.organizationId ?? null,
            isResponsible: entry.isResponsible,
            isNotRelevant: entry.isNotRelevant,
            sortOrder: entry.sortOrder ?? 0,
          }))
        );
      }

      return { success: true, count: input.allocations.length };
    }),

  importRows: protectedProcedure
    .input(
      z.object({
        revisionId: z.string().uuid(),
        rows: z.array(
          z.object({
            interfaceId: z.string().min(1).max(64),
            emplInternalRevision: z.number().int().optional(),
            groupCode: z.string().max(64).optional(),
            groupName: z.string().max(255).optional(),
            interfaceComponent: z.string().min(1).max(255),
            description: z.string().optional(),
            displayOrder: z.number().int().optional(),
            allocations: z
              .array(
                z.object({
                  phaseColumn: phaseColumnSchema,
                  organizationId: z.string().uuid().nullable().optional(),
                  isResponsible: z.boolean().optional().default(false),
                  isNotRelevant: z.boolean().optional().default(false),
                  sortOrder: z.number().int().optional().default(0),
                })
              )
              .optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, input.revisionId),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND" });
      if (revision.isLocked) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Revision is locked" });
      }
      await requireMatrixManager(revision.projectId, ctx.user.id);

      let imported = 0;
      for (const [idx, entry] of input.rows.entries()) {
        // eslint-disable-next-line no-await-in-loop
        const [row] = await db
          .insert(interfaceMatrixRows)
          .values({
            projectId: revision.projectId,
            revisionId: revision.id,
            interfaceId: entry.interfaceId,
            emplInternalRevision: entry.emplInternalRevision ?? null,
            groupCode: entry.groupCode ?? null,
            groupName: entry.groupName ?? null,
            interfaceComponent: entry.interfaceComponent,
            description: entry.description ?? null,
            displayOrder: entry.displayOrder ?? idx,
          })
          .onConflictDoUpdate({
            target: [interfaceMatrixRows.projectId, interfaceMatrixRows.revisionId, interfaceMatrixRows.interfaceId],
            set: {
              emplInternalRevision: entry.emplInternalRevision ?? null,
              groupCode: entry.groupCode ?? null,
              groupName: entry.groupName ?? null,
              interfaceComponent: entry.interfaceComponent,
              description: entry.description ?? null,
              displayOrder: entry.displayOrder ?? idx,
            },
          })
          .returning();

        if (entry.allocations && entry.allocations.length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await db.delete(interfaceMatrixAllocations).where(eq(interfaceMatrixAllocations.rowId, row.id));
          // eslint-disable-next-line no-await-in-loop
          await db.insert(interfaceMatrixAllocations).values(
            entry.allocations.map((allocation) => ({
              projectId: revision.projectId,
              rowId: row.id,
              phaseColumn: allocation.phaseColumn,
              organizationId: allocation.organizationId ?? null,
              isResponsible: allocation.isResponsible,
              isNotRelevant: allocation.isNotRelevant,
              sortOrder: allocation.sortOrder ?? 0,
            }))
          );
        }

        imported += 1;
      }

      return { imported };
    }),

  importFromTemplate: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        revisionId: z.string().uuid().optional(),
        revisionLabel: z.string().max(64).optional(),
        workbookBase64: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireMatrixManager(input.projectId, ctx.user.id);

      let revisionId = input.revisionId;
      if (!revisionId) {
        const [created] = await db
          .insert(interfaceMatrixRevisions)
          .values({
            projectId: input.projectId,
            revisionLabel: input.revisionLabel ?? `Imported-${new Date().toISOString().slice(0, 10)}`,
            createdBy: ctx.user.id,
          })
          .returning();
        revisionId = created.id;
      }

      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, requireUuid(revisionId)),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND", message: "Revision not found" });
      if (revision.isLocked) throw new TRPCError({ code: "BAD_REQUEST", message: "Revision is locked" });

      const workbook = XLSX.read(Buffer.from(input.workbookBase64, "base64"), { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const orgRows = await db.query.organizations.findMany({
        where: eq(organizations.projectId, input.projectId),
      });
      const orgByCode = new Map<string, string>();
      for (const org of orgRows) {
        if (org.abbreviation) orgByCode.set(org.abbreviation.toLowerCase(), org.id);
        orgByCode.set(org.name.toLowerCase(), org.id);
      }

      const unresolvedOrgCodes = new Set<string>();
      let importedRows = 0;
      let importedAllocations = 0;

      for (const [index, source] of rows.entries()) {
        const interfaceId = String(source.ID ?? source.Id ?? "").trim();
        const component = String(source["Interface Component"] ?? source.Interface ?? "").trim();
        if (!interfaceId || !component) continue;

        const [row] = await db
          .insert(interfaceMatrixRows)
          .values({
            projectId: input.projectId,
            revisionId: revision.id,
            interfaceId,
            emplInternalRevision: Number(String(source["EMPL int Rev"] || "").trim()) || null,
            groupCode: String(source.Group ?? "").trim() || null,
            groupName: String(source["Group Name"] ?? "").trim() || null,
            interfaceComponent: component,
            description: String(source.Description ?? "").trim() || null,
            displayOrder: index,
          })
          .onConflictDoUpdate({
            target: [interfaceMatrixRows.projectId, interfaceMatrixRows.revisionId, interfaceMatrixRows.interfaceId],
            set: {
              interfaceComponent: component,
              description: String(source.Description ?? "").trim() || null,
              displayOrder: index,
            },
          })
          .returning();

        await db.delete(interfaceMatrixAllocations).where(eq(interfaceMatrixAllocations.rowId, row.id));

        const allocations: Array<typeof interfaceMatrixAllocations.$inferInsert> = [];
        for (const phase of PHASE_COLUMNS) {
          const inputKey = phase.toUpperCase().replace("_", "-");
          const raw = String(source[inputKey] ?? source[phase] ?? "").trim();
          const entries = splitParticipants(raw);
          if (entries.length === 0) continue;

          for (const [entryIndex, entry] of entries.entries()) {
            let organizationId: string | null = null;
            if (!entry.isNotRelevant) {
              organizationId = orgByCode.get(entry.code.toLowerCase()) ?? null;
              if (!organizationId) unresolvedOrgCodes.add(entry.code);
            }
            allocations.push({
              projectId: input.projectId,
              rowId: row.id,
              phaseColumn: phase,
              organizationId,
              isResponsible: entry.isResponsible,
              isNotRelevant: entry.isNotRelevant,
              sortOrder: entryIndex,
            });
          }
        }

        if (allocations.length > 0) {
          await db.insert(interfaceMatrixAllocations).values(allocations);
          importedAllocations += allocations.length;
        }

        importedRows += 1;
      }

      return {
        revisionId: revision.id,
        importedRows,
        importedAllocations,
        unresolvedOrgCodes: Array.from(unresolvedOrgCodes),
      };
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

      const rowWhere = input.revisionId
        ? and(
            eq(interfaceMatrixRows.projectId, input.projectId),
            eq(interfaceMatrixRows.revisionId, input.revisionId)
          )
        : eq(interfaceMatrixRows.projectId, input.projectId);

      const rows = await db.query.interfaceMatrixRows.findMany({
        where: rowWhere,
        orderBy: [asc(interfaceMatrixRows.displayOrder), asc(interfaceMatrixRows.interfaceId)],
      });

      if (rows.length === 0) return [];

      const rowIds = rows.map((row) => row.id);
      const allocations = await db.query.interfaceMatrixAllocations.findMany({
        where: inArray(interfaceMatrixAllocations.rowId, rowIds),
        orderBy: [asc(interfaceMatrixAllocations.sortOrder)],
      });

      const byRow = new Map<string, typeof allocations>();
      for (const allocation of allocations) {
        const list = byRow.get(allocation.rowId) ?? [];
        list.push(allocation);
        byRow.set(allocation.rowId, list);
      }

      return rows.map((row) => ({ ...row, allocations: byRow.get(row.id) ?? [] }));
    }),

  getValidation: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        revisionId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const rows = await db.query.interfaceMatrixRows.findMany({
        where: and(
          eq(interfaceMatrixRows.projectId, input.projectId),
          eq(interfaceMatrixRows.revisionId, input.revisionId)
        ),
        columns: { id: true, interfaceId: true },
      });

      if (rows.length === 0) {
        return {
          unresolvedOrgCodes: [] as string[],
          multiResponsibleViolations: [] as Array<{ rowId: string; phaseColumn: string }>,
          missingRequiredAllocations: [] as Array<{ rowId: string; phaseColumn: string }>,
        };
      }

      const rowIds = rows.map((row) => row.id);
      const allocations = await db.query.interfaceMatrixAllocations.findMany({
        where: inArray(interfaceMatrixAllocations.rowId, rowIds),
      });

      const perRowPhase = new Map<string, typeof allocations>();
      const unresolvedOrgCodes = new Set<string>();

      for (const allocation of allocations) {
        const key = `${allocation.rowId}:${allocation.phaseColumn}`;
        const list = perRowPhase.get(key) ?? [];
        list.push(allocation);
        perRowPhase.set(key, list);
        if (!allocation.isNotRelevant && !allocation.organizationId) {
          unresolvedOrgCodes.add(`${allocation.rowId}:${allocation.phaseColumn}`);
        }
      }

      const requiredColumns = ["spec", "des", "sup"] as const;
      const multiResponsibleViolations: Array<{ rowId: string; phaseColumn: string }> = [];
      const missingRequiredAllocations: Array<{ rowId: string; phaseColumn: string }> = [];

      for (const row of rows) {
        for (const phaseColumn of requiredColumns) {
          const key = `${row.id}:${phaseColumn}`;
          const entries = perRowPhase.get(key) ?? [];
          if (entries.length === 0) {
            missingRequiredAllocations.push({ rowId: row.id, phaseColumn });
          }
          const responsibleCount = entries.filter(
            (entry) => entry.isResponsible && !entry.isNotRelevant
          ).length;
          if (responsibleCount > 1) {
            multiResponsibleViolations.push({ rowId: row.id, phaseColumn });
          }
        }
      }

      return {
        unresolvedOrgCodes: Array.from(unresolvedOrgCodes),
        multiResponsibleViolations,
        missingRequiredAllocations,
      };
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

  generatePack: protectedProcedure
    .input(
      z.object({
        revisionId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, input.revisionId),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND" });
      if (!revision.publishedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Publish revision before generating a pack" });
      }

      const member = await requireMatrixManager(revision.projectId, ctx.user.id);
      await requireInterfaceRole(member.id, ["employer_interface_manager", "interface_coordinator"]);

      const rows = await db.query.interfaceMatrixRows.findMany({
        where: eq(interfaceMatrixRows.revisionId, revision.id),
        orderBy: [asc(interfaceMatrixRows.displayOrder), asc(interfaceMatrixRows.interfaceId)],
      });

      const rowIds = rows.map((row) => row.id);
      const allocations = rowIds.length
        ? await db.query.interfaceMatrixAllocations.findMany({
            where: inArray(interfaceMatrixAllocations.rowId, rowIds),
            orderBy: [asc(interfaceMatrixAllocations.sortOrder)],
          })
        : [];

      const orgRows = await db.query.organizations.findMany({
        where: eq(organizations.projectId, revision.projectId),
      });
      const orgById = new Map(orgRows.map((org) => [org.id, org]));

      const allocByRowPhase = new Map<string, Array<{ code: string; isResponsible: boolean; isNotRelevant: boolean }>>();
      for (const allocation of allocations) {
        const key = `${allocation.rowId}:${allocation.phaseColumn}`;
        const list = allocByRowPhase.get(key) ?? [];
        list.push({
          code: allocation.organizationId ? (orgById.get(allocation.organizationId)?.abbreviation ?? orgById.get(allocation.organizationId)?.name ?? "") : "",
          isResponsible: allocation.isResponsible,
          isNotRelevant: allocation.isNotRelevant,
        });
        allocByRowPhase.set(key, list);
      }

      const exportRows = rows.map((row) => {
        const base: Record<string, unknown> = {
          ID: row.interfaceId,
          "EMPL int Rev": row.emplInternalRevision ?? "",
          Group: row.groupCode ?? "",
          "Group Name": row.groupName ?? "",
          "Interface Component": row.interfaceComponent,
          Description: row.description ?? "",
        };

        for (const phase of PHASE_COLUMNS) {
          const phaseKey = phase.toUpperCase().replace("_", "-");
          const entries = allocByRowPhase.get(`${row.id}:${phase}`) ?? [];
          base[phaseKey] = buildParticipantsDisplay(entries);
        }

        return base;
      });

      const wb = XLSX.utils.book_new();
      const wsMatrix = XLSX.utils.json_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(wb, wsMatrix, "Matrix");

      const wsAbbrev = XLSX.utils.json_to_sheet(
        orgRows.map((org) => ({
          Abbreviation: org.abbreviation ?? "",
          Name: org.name,
          Type: org.type,
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsAbbrev, "Abbreviations");

      const wsRev = XLSX.utils.json_to_sheet([
        {
          Revision: revision.revisionLabel,
          PublishedAt: revision.publishedAt?.toISOString() ?? "",
          ApprovedBy: revision.approvedBy ?? "",
          PreparedBy: revision.preparedBy ?? "",
          CheckedBy: revision.checkedBy ?? "",
          IssuedFor: revision.issuedFor ?? "",
          SourceDocument: revision.sourceDocumentRef ?? "",
        },
      ]);
      XLSX.utils.book_append_sheet(wb, wsRev, "Revision History");

      const wsMeta = XLSX.utils.json_to_sheet([
        {
          GeneratedAt: new Date().toISOString(),
          ProjectId: revision.projectId,
          RevisionId: revision.id,
          RowCount: rows.length,
        },
      ]);
      XLSX.utils.book_append_sheet(wb, wsMeta, "Metadata");

      const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

      const pdfLines = [
        `Project: ${revision.projectId}`,
        `Revision: ${revision.revisionLabel}`,
        `Rows: ${rows.length}`,
        `Generated: ${new Date().toISOString()}`,
      ];
      const pdfBuffer = generateSimplePdf("Interface Matrix Pack", pdfLines);

      const checksumSha256 = createHash("sha256")
        .update(xlsxBuffer)
        .update(pdfBuffer)
        .digest("hex");

      const safeLabel = revision.revisionLabel.replace(/[^a-zA-Z0-9_.-]+/g, "_");
      const xlsxPath = `projects/${revision.projectId}/interface-matrix/packs/${revision.id}/${safeLabel}.xlsx`;
      const pdfPath = `projects/${revision.projectId}/interface-matrix/packs/${revision.id}/${safeLabel}.pdf`;

      const admin = createAdminClient();
      const xlsxUpload = await admin.storage.from("attachments").upload(xlsxPath, xlsxBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });
      if (xlsxUpload.error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: xlsxUpload.error.message });
      }

      const pdfUpload = await admin.storage.from("attachments").upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (pdfUpload.error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: pdfUpload.error.message });
      }

      const [pack] = await db
        .insert(interfaceMatrixPacks)
        .values({
          projectId: revision.projectId,
          revisionId: revision.id,
          xlsxStoragePath: xlsxPath,
          pdfStoragePath: pdfPath,
          checksumSha256,
          generatedBy: ctx.user.id,
        })
        .returning();

      return pack;
    }),

  listPacks: protectedProcedure
    .input(z.object({ revisionId: z.string().uuid().optional() }))
    .query(async ({ input, ctx }) => {
      if (!input.revisionId) return [];
      const revision = await db.query.interfaceMatrixRevisions.findFirst({
        where: eq(interfaceMatrixRevisions.id, input.revisionId),
      });
      if (!revision) throw new TRPCError({ code: "NOT_FOUND" });
      await assertMember(ctx.user.id, revision.projectId);

      return db.query.interfaceMatrixPacks.findMany({
        where: eq(interfaceMatrixPacks.revisionId, revision.id),
        orderBy: [desc(interfaceMatrixPacks.generatedAt)],
      });
    }),

  downloadPack: protectedProcedure
    .input(z.object({ packId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const pack = await db.query.interfaceMatrixPacks.findFirst({
        where: eq(interfaceMatrixPacks.id, input.packId),
      });
      if (!pack) throw new TRPCError({ code: "NOT_FOUND" });

      await assertMember(ctx.user.id, pack.projectId);

      const admin = createAdminClient();
      const [xlsxSigned, pdfSigned] = await Promise.all([
        admin.storage.from("attachments").createSignedUrl(pack.xlsxStoragePath, 120),
        admin.storage.from("attachments").createSignedUrl(pack.pdfStoragePath, 120),
      ]);

      if (xlsxSigned.error || pdfSigned.error || !xlsxSigned.data || !pdfSigned.data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: xlsxSigned.error?.message ?? pdfSigned.error?.message ?? "Failed to generate signed URLs",
        });
      }

      return {
        xlsxUrl: xlsxSigned.data.signedUrl,
        pdfUrl: pdfSigned.data.signedUrl,
      };
    }),
});
