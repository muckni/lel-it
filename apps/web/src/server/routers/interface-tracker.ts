import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  db,
  interfaceCaseEvents,
  interfaceCases,
  interfaceTrackerCaseLinks,
  interfaceTrackerEvents,
  interfaceTrackerItems,
} from "@owit/db";
import { TRACKER_ITEM_STATUSES, type TrackerItemStatus } from "@owit/shared";
import { assertMember } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  appendInterfaceCaseEvent,
  getProjectMemberByUser,
  requireInterfaceRole,
} from "@/server/lib/interface-compliance";

const trackerStatusSchema = z.enum(TRACKER_ITEM_STATUSES);

function normalizeTrackerStatus(input: unknown): TrackerItemStatus {
  const raw = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (raw === "open") return "open";
  if (raw === "closed") return "closed";
  if (raw === "info") return "info";
  if (raw === "hold") return "hold";
  if (raw === "xclosed") return "xclosed";
  return "open";
}

function parseExcelDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return null;
  const asDate = new Date(text);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.toISOString().slice(0, 10);
}

function extractEventLines(notes: string): Array<{ eventDate: string | null; content: string }> {
  const lines = notes
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const m = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[:\-]?\s*(.*)$/);
    if (m) {
      const year = m[3].length === 2 ? `20${m[3]}` : m[3];
      const normalized = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      return {
        eventDate: normalized,
        content: m[4] || line,
      };
    }

    return {
      eventDate: null,
      content: line,
    };
  });
}

async function requireTrackerManager(projectId: string, userId: string) {
  await assertMember(userId, projectId);
  const member = await getProjectMemberByUser(projectId, userId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN" });
  await requireInterfaceRole(member.id, [
    "employer_interface_manager",
    "contractor_interface_manager",
    "interface_coordinator",
    "requesting_party",
  ]);
  return member;
}

export const interfaceTrackerRouter = createTRPCRouter({
  importWorkbook: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        workbookBase64: z.string().min(1),
        sourceWorkbook: z.string().max(255).optional(),
        dryRun: z.boolean().optional().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const member = await requireTrackerManager(input.projectId, ctx.user.id);

      const workbook = XLSX.read(Buffer.from(input.workbookBase64, "base64"), { type: "buffer" });
      const targetSheets = workbook.SheetNames.filter((name) => name === "Sheet1" || name === "Sheet3");
      const pendingRows: Array<{
        externalId: string;
        sectionTitle: string | null;
        status: TrackerItemStatus;
        openedOn: string | null;
        actionText: string | null;
        actionOwnerText: string | null;
        whoText: string | null;
        dueTextRaw: string | null;
        dueDate: string | null;
        impactedText: string | null;
        commentsText: string | null;
        events: Array<{ eventDate: string | null; content: string }>;
      }> = [];

      for (const sheetName of targetSheets) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: true,
        });

        let sectionTitle: string | null = null;
        for (const row of rows) {
          const rawId = String(row.ID ?? "").trim();
          if (!rawId) continue;

          const isDataRow = /^\d+(\.\d+)+$/.test(rawId) || /^\d+$/.test(rawId);
          if (!isDataRow) {
            sectionTitle = rawId;
            continue;
          }

          const actionText = String(row["Notes & Action"] ?? "").trim();
          const dueRaw = String(row.When ?? "").trim();

          pendingRows.push({
            externalId: rawId,
            sectionTitle,
            status: normalizeTrackerStatus(row.Status),
            openedOn: parseExcelDate(row.Date),
            actionText: actionText || null,
            actionOwnerText: String(row["Action on"] ?? "").trim() || null,
            whoText: String(row.Who ?? "").trim() || null,
            dueTextRaw: dueRaw || null,
            dueDate: parseExcelDate(row.When),
            impactedText: String(row.Impacted ?? "").trim() || null,
            commentsText: String(row.Comments ?? "").trim() || null,
            events: actionText ? extractEventLines(actionText) : [],
          });
        }
      }

      if (input.dryRun) {
        return {
          dryRun: true,
          parsedItems: pendingRows.length,
        };
      }

      let imported = 0;
      let eventsImported = 0;
      for (const item of pendingRows) {
        // eslint-disable-next-line no-await-in-loop
        const [created] = await db
          .insert(interfaceTrackerItems)
          .values({
            projectId: input.projectId,
            externalId: item.externalId,
            sectionTitle: item.sectionTitle,
            status: item.status,
            openedOn: item.openedOn,
            actionText: item.actionText,
            actionOwnerText: item.actionOwnerText,
            whoText: item.whoText,
            dueTextRaw: item.dueTextRaw,
            dueDate: item.dueDate,
            impactedText: item.impactedText,
            commentsText: item.commentsText,
            sourceWorkbook: input.sourceWorkbook ?? null,
            createdBy: ctx.user.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              interfaceTrackerItems.projectId,
              interfaceTrackerItems.externalId,
              interfaceTrackerItems.sectionTitle,
            ],
            set: {
              status: item.status,
              openedOn: item.openedOn,
              actionText: item.actionText,
              actionOwnerText: item.actionOwnerText,
              whoText: item.whoText,
              dueTextRaw: item.dueTextRaw,
              dueDate: item.dueDate,
              impactedText: item.impactedText,
              commentsText: item.commentsText,
              sourceWorkbook: input.sourceWorkbook ?? null,
              updatedAt: new Date(),
            },
          })
          .returning();

        // eslint-disable-next-line no-await-in-loop
        await db.delete(interfaceTrackerEvents).where(eq(interfaceTrackerEvents.trackerItemId, created.id));

        if (item.events.length > 0) {
          // eslint-disable-next-line no-await-in-loop
          await db.insert(interfaceTrackerEvents).values(
            item.events.map((event) => ({
              projectId: input.projectId,
              trackerItemId: created.id,
              eventDate: event.eventDate,
              content: event.content,
              createdBy: ctx.user.id,
            }))
          );
          eventsImported += item.events.length;
        }

        imported += 1;
      }

      return {
        dryRun: false,
        imported,
        eventsImported,
        actorMemberId: member.id,
      };
    }),

  listItems: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: trackerStatusSchema.optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(1000).default(300),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const whereClauses = [eq(interfaceTrackerItems.projectId, input.projectId)];
      if (input.status) {
        whereClauses.push(eq(interfaceTrackerItems.status, input.status));
      }

      const rows = await db.query.interfaceTrackerItems.findMany({
        where: and(...whereClauses),
        orderBy: [desc(interfaceTrackerItems.updatedAt)],
        limit: input.limit,
      });

      if (!input.search?.trim()) return rows;
      const search = input.search.trim().toLowerCase();
      return rows.filter((row) => {
        return (
          row.externalId.toLowerCase().includes(search) ||
          (row.sectionTitle ?? "").toLowerCase().includes(search) ||
          (row.actionText ?? "").toLowerCase().includes(search) ||
          (row.commentsText ?? "").toLowerCase().includes(search)
        );
      });
    }),

  getTimeline: protectedProcedure
    .input(z.object({ trackerItemId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const item = await db.query.interfaceTrackerItems.findFirst({
        where: eq(interfaceTrackerItems.id, input.trackerItemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await assertMember(ctx.user.id, item.projectId);

      const [events, links] = await Promise.all([
        db.query.interfaceTrackerEvents.findMany({
          where: eq(interfaceTrackerEvents.trackerItemId, item.id),
          orderBy: [desc(interfaceTrackerEvents.createdAt)],
        }),
        db.query.interfaceTrackerCaseLinks.findMany({
          where: eq(interfaceTrackerCaseLinks.trackerItemId, item.id),
          orderBy: [desc(interfaceTrackerCaseLinks.createdAt)],
        }),
      ]);

      const caseIds = links.map((link) => link.caseId);
      const linkedCases = caseIds.length
        ? await db.query.interfaceCases.findMany({
            where: inArray(interfaceCases.id, caseIds),
          })
        : [];

      return {
        item,
        events,
        links,
        linkedCases,
      };
    }),

  updateStatus: protectedProcedure
    .input(z.object({ trackerItemId: z.string().uuid(), status: trackerStatusSchema }))
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceTrackerItems.findFirst({
        where: eq(interfaceTrackerItems.id, input.trackerItemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      await requireTrackerManager(item.projectId, ctx.user.id);

      const [updated] = await db
        .update(interfaceTrackerItems)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(interfaceTrackerItems.id, item.id))
        .returning();

      return updated;
    }),

  linkCase: protectedProcedure
    .input(z.object({ trackerItemId: z.string().uuid(), caseId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [item, caseRow] = await Promise.all([
        db.query.interfaceTrackerItems.findFirst({ where: eq(interfaceTrackerItems.id, input.trackerItemId) }),
        db.query.interfaceCases.findFirst({ where: eq(interfaceCases.id, input.caseId) }),
      ]);

      if (!item || !caseRow) throw new TRPCError({ code: "NOT_FOUND" });
      if (item.projectId !== caseRow.projectId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tracker item and case must belong to the same project" });
      }

      const member = await requireTrackerManager(item.projectId, ctx.user.id);

      const [link] = await db
        .insert(interfaceTrackerCaseLinks)
        .values({
          projectId: item.projectId,
          trackerItemId: item.id,
          caseId: caseRow.id,
          linkedBy: ctx.user.id,
        })
        .onConflictDoNothing()
        .returning();

      await appendInterfaceCaseEvent({
        caseId: caseRow.id,
        projectId: caseRow.projectId,
        eventType: "assignment_changed",
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        summary: `Linked tracker item ${item.externalId}`,
        payload: {
          trackerItemId: item.id,
          trackerExternalId: item.externalId,
        },
      });

      return link ?? { trackerItemId: item.id, caseId: caseRow.id };
    }),

  promoteToCase: protectedProcedure
    .input(
      z.object({
        trackerItemId: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await db.query.interfaceTrackerItems.findFirst({
        where: eq(interfaceTrackerItems.id, input.trackerItemId),
      });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      const member = await requireTrackerManager(item.projectId, ctx.user.id);

      const [existingLink] = await db
        .select({ caseId: interfaceTrackerCaseLinks.caseId })
        .from(interfaceTrackerCaseLinks)
        .where(eq(interfaceTrackerCaseLinks.trackerItemId, item.id))
        .limit(1);

      if (existingLink?.caseId) {
        const existingCase = await db.query.interfaceCases.findFirst({
          where: eq(interfaceCases.id, existingLink.caseId),
        });
        if (existingCase) return existingCase;
      }

      const [createdCase] = await db
        .insert(interfaceCases)
        .values({
          projectId: item.projectId,
          title: input.title ?? `${item.sectionTitle ?? "Tracker"} ${item.externalId}`,
          description: item.actionText,
          sourceEntityType: "tracker_item",
          sourceEntityId: item.id,
          currentState: "draft_dir",
          employerGateRequired: true,
          createdBy: ctx.user.id,
        })
        .returning();

      await db.insert(interfaceTrackerCaseLinks).values({
        projectId: item.projectId,
        trackerItemId: item.id,
        caseId: createdCase.id,
        linkedBy: ctx.user.id,
      });

      await db.insert(interfaceCaseEvents).values({
        caseId: createdCase.id,
        projectId: item.projectId,
        eventType: "state_changed",
        actorUserId: ctx.user.id,
        actorMemberId: member.id,
        toState: "draft_dir",
        summary: `Promoted from tracker item ${item.externalId}`,
      });

      return createdCase;
    }),
});
