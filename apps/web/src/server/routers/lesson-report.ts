import { createHash } from "crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import * as XLSX from "xlsx";
import {
  db,
  lessonPackageReports,
  lessonTrackAActions,
  lessonTrackBEscalations,
  lessonsLearned,
  projects,
  workPackages,
} from "@owit/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertMember } from "@/server/lib/rbac";
import { requireLessonRole } from "@/server/lib/lesson-rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

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

export const lessonReportRouter = createTRPCRouter({
  generatePack: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        cycleId: z.string().uuid().optional(),
        packageId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);

      const [project, packageRow] = await Promise.all([
        db.query.projects.findFirst({
          where: eq(projects.id, input.projectId),
          columns: { id: true, name: true },
        }),
        input.packageId
          ? db.query.workPackages.findFirst({
              where: and(eq(workPackages.id, input.packageId), eq(workPackages.projectId, input.projectId)),
              columns: { id: true, code: true, name: true },
            })
          : Promise.resolve(null),
      ]);

      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      const whereCommon = [eq(lessonsLearned.projectId, input.projectId)] as any[];
      if (input.packageId) {
        whereCommon.push(eq(lessonsLearned.workPackageId, input.packageId));
      }

      const lessons = await db.query.lessonsLearned.findMany({
        where: and(...whereCommon),
        orderBy: [desc(lessonsLearned.createdAt)],
      });

      const lessonIds = lessons.map((lesson) => lesson.id);

      const [trackA, trackB] = await Promise.all([
        lessonIds.length
          ? db.query.lessonTrackAActions.findMany({
              where: and(
                eq(lessonTrackAActions.projectId, input.projectId),
                inArray(lessonTrackAActions.lessonId, lessonIds)
              ),
              orderBy: [desc(lessonTrackAActions.createdAt)],
            })
          : Promise.resolve([]),
        lessonIds.length
          ? db.query.lessonTrackBEscalations.findMany({
              where: and(
                eq(lessonTrackBEscalations.projectId, input.projectId),
                inArray(lessonTrackBEscalations.lessonId, lessonIds)
              ),
              orderBy: [desc(lessonTrackBEscalations.createdAt)],
            })
          : Promise.resolve([]),
      ]);

      const html = `
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
          h1, h2, h3 { margin: 0 0 8px 0; }
          .muted { color: #666; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; vertical-align: top; }
          th { background: #f7f7f7; }
        </style>
      </head>
      <body>
        <h1>Lessons Package Report</h1>
        <p class="muted">Project: ${project.name} · Package: ${packageRow ? `${packageRow.code} - ${packageRow.name}` : "All"} · Generated: ${new Date().toISOString()}</p>

        <h2>Section 1: Summary</h2>
        <p>Total lessons reviewed: <b>${lessons.length}</b></p>
        <p>Track A actions: <b>${trackA.length}</b> · Track B escalations: <b>${trackB.length}</b></p>

        <h2>Section 2: Lessons</h2>
        <table>
          <thead><tr><th>Code/Title</th><th>Status</th><th>Type</th><th>Discipline</th><th>Workflow</th></tr></thead>
          <tbody>
            ${lessons
              .map(
                (lesson) => `<tr><td><b>${lesson.title}</b><div class="muted">${lesson.id}</div></td><td>${lesson.status}</td><td>${lesson.type}</td><td>${lesson.discipline}</td><td>${lesson.workflowState}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>

        <h2>Section 3: Track A Action Plan</h2>
        <table>
          <thead><tr><th>Action</th><th>Owner</th><th>Status</th><th>Due</th><th>Approval</th></tr></thead>
          <tbody>
            ${trackA
              .map(
                (action) => `<tr><td>${action.actionText}</td><td>${action.ownerUserId ?? "Unassigned"}</td><td>${action.status}</td><td>${action.dueAt ?? "-"}</td><td>${action.approvalLevel ?? "-"}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>

        <h2>Section 4: Track B Structural Recommendations</h2>
        <table>
          <thead><tr><th>Issue</th><th>Proposed Corporate Action</th><th>Status</th><th>Target Phase</th></tr></thead>
          <tbody>
            ${trackB
              .map(
                (item) => `<tr><td>${item.structuralIssue}</td><td>${item.proposedCorporateAction}</td><td>${item.status}</td><td>${item.recommendedTargetPhase ?? "-"}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>`;

      const actionRows = trackA.map((action) => ({
        action_id: action.id,
        lesson_id: action.lessonId,
        action_text: action.actionText,
        owner_user_id: action.ownerUserId ?? "",
        status: action.status,
        due_at: action.dueAt ? new Date(action.dueAt).toISOString() : "",
        approval_level: action.approvalLevel ?? "",
      }));

      const escalationRows = trackB.map((item) => ({
        escalation_id: item.id,
        lesson_id: item.lessonId,
        status: item.status,
        structural_issue: item.structuralIssue,
        proposed_corporate_action: item.proposedCorporateAction,
        due_by: item.dueBy ? new Date(item.dueBy).toISOString() : "",
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(
          lessons.map((lesson) => ({
            lesson_id: lesson.id,
            title: lesson.title,
            status: lesson.status,
            type: lesson.type,
            discipline: lesson.discipline,
            workflow_state: lesson.workflowState,
          }))
        ),
        "Lessons"
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(actionRows), "Track A Actions");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(escalationRows), "Track B");
      const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

      const htmlBuffer = Buffer.from(html, "utf-8");
      const pdfBuffer = generateSimplePdf("Lessons Package Report", [
        `Project: ${project.name}`,
        `Package: ${packageRow ? `${packageRow.code} - ${packageRow.name}` : "All"}`,
        `Lessons: ${lessons.length}`,
        `Track A actions: ${trackA.length}`,
        `Track B escalations: ${trackB.length}`,
        `Generated: ${new Date().toISOString()}`,
      ]);

      const checksumSha256 = createHash("sha256")
        .update(htmlBuffer)
        .update(pdfBuffer)
        .update(xlsxBuffer)
        .digest("hex");

      const safePackage = (packageRow?.code ?? "ALL").replace(/[^a-zA-Z0-9_.-]+/g, "_");
      const basePath = `projects/${input.projectId}/lessons/reports/${input.cycleId ?? "adhoc"}/${safePackage}`;
      const htmlPath = `${basePath}.html`;
      const pdfPath = `${basePath}.pdf`;
      const xlsxPath = `${basePath}.xlsx`;

      const admin = createAdminClient();
      const [htmlUpload, pdfUpload, xlsxUpload] = await Promise.all([
        admin.storage.from("attachments").upload(htmlPath, htmlBuffer, {
          contentType: "text/html; charset=utf-8",
          upsert: true,
        }),
        admin.storage.from("attachments").upload(pdfPath, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        }),
        admin.storage.from("attachments").upload(xlsxPath, xlsxBuffer, {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        }),
      ]);

      if (htmlUpload.error || pdfUpload.error || xlsxUpload.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            htmlUpload.error?.message ??
            pdfUpload.error?.message ??
            xlsxUpload.error?.message ??
            "Failed to upload report pack",
        });
      }

      const [pack] = await db
        .insert(lessonPackageReports)
        .values({
          projectId: input.projectId,
          cycleId: input.cycleId ?? null,
          packageId: input.packageId ?? null,
          reportHtmlPath: htmlPath,
          reportPdfPath: pdfPath,
          reportXlsxPath: xlsxPath,
          checksumSha256,
          generatedBy: ctx.user.id,
        })
        .returning();

      return pack;
    }),

  listPacks: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), cycleId: z.string().uuid().optional() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.lessonPackageReports.findMany({
        where: and(
          eq(lessonPackageReports.projectId, input.projectId),
          input.cycleId ? eq(lessonPackageReports.cycleId, input.cycleId) : undefined
        ),
        with: {
          package: { columns: { id: true, code: true, name: true } },
        },
        orderBy: [desc(lessonPackageReports.generatedAt)],
      });
    }),

  downloadPack: protectedProcedure
    .input(z.object({ packId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const pack = await db.query.lessonPackageReports.findFirst({
        where: eq(lessonPackageReports.id, input.packId),
      });
      if (!pack) throw new TRPCError({ code: "NOT_FOUND" });
      await assertMember(ctx.user.id, pack.projectId);

      const admin = createAdminClient();
      const [htmlSigned, pdfSigned, xlsxSigned] = await Promise.all([
        admin.storage.from("attachments").createSignedUrl(pack.reportHtmlPath, 120),
        admin.storage.from("attachments").createSignedUrl(pack.reportPdfPath, 120),
        admin.storage.from("attachments").createSignedUrl(pack.reportXlsxPath, 120),
      ]);

      if (htmlSigned.error || pdfSigned.error || xlsxSigned.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            htmlSigned.error?.message ??
            pdfSigned.error?.message ??
            xlsxSigned.error?.message ??
            "Failed to generate report URLs",
        });
      }

      return {
        htmlUrl: htmlSigned.data.signedUrl,
        pdfUrl: pdfSigned.data.signedUrl,
        xlsxUrl: xlsxSigned.data.signedUrl,
      };
    }),
});
