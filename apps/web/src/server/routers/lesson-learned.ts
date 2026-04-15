import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  interfacePoints,
  lessonLearnedChangeRequests,
  lessonLearnedPoints,
  lessonsLearned,
  notifications,
  projectMembers,
  workPackages,
} from "@owit/db";
import {
  LESSON_CHANGE_REQUEST_STATUSES,
  LESSON_DISCIPLINES,
  LESSON_OWNERSHIP_STATES,
  LESSON_STATUSES,
  LESSON_TYPES,
  PROJECT_PHASES,
} from "@owit/shared";
import { projectIdForLessonLearned } from "@/server/lib/project-id";
import { getVisibleLessonOwnershipStates } from "@/server/lib/lesson-visibility";
import { assertMember, getProjectRole, requireRole } from "@/server/lib/rbac";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const lessonStatusSchema = z.enum(LESSON_STATUSES);
const lessonTypeSchema = z.enum(LESSON_TYPES);
const lessonDisciplineSchema = z.enum(LESSON_DISCIPLINES);
const lessonOwnershipStateSchema = z.enum(LESSON_OWNERSHIP_STATES);
const projectPhaseSchema = z.enum(PROJECT_PHASES);
const changeRequestStatusSchema = z.enum(LESSON_CHANGE_REQUEST_STATUSES);

function isEditorOrAdmin(role: Awaited<ReturnType<typeof getProjectRole>>) {
  return role === "editor" || role === "admin";
}

async function ensureWorkPackageInProject(
  projectId: string,
  workPackageId: string | null | undefined
) {
  if (!workPackageId) return;
  const row = await db.query.workPackages.findFirst({
    where: eq(workPackages.id, workPackageId),
    columns: { projectId: true },
  });
  if (!row || row.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Work package does not belong to the selected project",
    });
  }
}

async function ensurePointsInProject(projectId: string, interfacePointIds: string[]) {
  if (interfacePointIds.length === 0) return;
  const rows = await db.query.interfacePoints.findMany({
    where: inArray(interfacePoints.id, interfacePointIds),
    columns: { id: true },
    with: {
      agreement: {
        columns: { id: true },
        with: {
          register: { columns: { projectId: true } },
        },
      },
    },
  });

  if (rows.length !== interfacePointIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "One or more interface points were not found" });
  }

  const invalid = rows.some((row) => row.agreement.register.projectId !== projectId);
  if (invalid) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "One or more interface points do not belong to the selected project",
    });
  }
}

async function notifyEditorsAndAdmins(projectId: string, actorUserId: string, message: string, referenceId: string) {
  const members = await db.query.projectMembers.findMany({
    where: and(eq(projectMembers.projectId, projectId), inArray(projectMembers.role, ["admin", "editor"])),
    columns: { userId: true },
  });
  const recipients = members
    .map((m) => m.userId)
    .filter((userId) => userId !== actorUserId);
  if (recipients.length === 0) return;

  await db
    .insert(notifications)
    .values(
      recipients.map((userId) => ({
        userId,
        type: "lesson_review_pending",
        referenceType: "lesson_learned",
        referenceId,
        message,
      }))
    )
    .onConflictDoNothing();
}

export const lessonLearnedRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: lessonStatusSchema.optional(),
        type: lessonTypeSchema.optional(),
        discipline: lessonDisciplineSchema.optional(),
        ownershipState: lessonOwnershipStateSchema.optional(),
        interfacePointId: z.string().uuid().optional(),
        workPackageId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const visibleOwnershipStates = await getVisibleLessonOwnershipStates(
        input.projectId,
        ctx.user.id
      );

      let lessonIdsByPoint: string[] | undefined;
      if (input.interfacePointId) {
        const links = await db.query.lessonLearnedPoints.findMany({
          where: eq(lessonLearnedPoints.interfacePointId, input.interfacePointId),
          columns: { lessonId: true },
        });
        lessonIdsByPoint = links.map((link) => link.lessonId);
        if (lessonIdsByPoint.length === 0) return [];
      }

      const rows = await db.query.lessonsLearned.findMany({
        where: and(
          eq(lessonsLearned.projectId, input.projectId),
          input.status ? eq(lessonsLearned.status, input.status) : undefined,
          input.type ? eq(lessonsLearned.type, input.type) : undefined,
          input.discipline ? eq(lessonsLearned.discipline, input.discipline) : undefined,
          input.ownershipState ? eq(lessonsLearned.ownershipState, input.ownershipState) : undefined,
          inArray(lessonsLearned.ownershipState, visibleOwnershipStates),
          input.workPackageId ? eq(lessonsLearned.workPackageId, input.workPackageId) : undefined,
          lessonIdsByPoint ? inArray(lessonsLearned.id, lessonIdsByPoint) : undefined
        ),
        with: {
          workPackage: { columns: { id: true, code: true, name: true, color: true } },
          linkedPoints: {
            with: {
              interfacePoint: {
                columns: { id: true, code: true, title: true },
                with: {
                  agreement: {
                    columns: { id: true },
                    with: {
                      register: {
                        columns: { id: true },
                      },
                    },
                  },
                },
              },
            },
          },
          changeRequests: {
            columns: {
              id: true,
              proposerId: true,
              status: true,
              createdAt: true,
            },
            orderBy: [desc(lessonLearnedChangeRequests.createdAt)],
          },
        },
        orderBy: [desc(lessonsLearned.createdAt)],
      });

      return rows.map((row) => ({
        ...row,
        pendingChangeRequest:
          row.changeRequests.find((request) => request.status === "pending") ?? null,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await assertMember(ctx.user.id, projectId);
      const visibleOwnershipStates = await getVisibleLessonOwnershipStates(
        projectId,
        ctx.user.id
      );
      const row = await db.query.lessonsLearned.findFirst({
        where: and(
          eq(lessonsLearned.id, input.id),
          inArray(lessonsLearned.ownershipState, visibleOwnershipStates)
        ),
        with: {
          workPackage: { columns: { id: true, code: true, name: true, color: true } },
          linkedPoints: {
            with: {
              interfacePoint: {
                columns: { id: true, code: true, title: true },
                with: {
                  agreement: {
                    columns: { id: true },
                    with: {
                      register: { columns: { id: true } },
                    },
                  },
                },
              },
            },
          },
          changeRequests: {
            orderBy: [desc(lessonLearnedChangeRequests.createdAt)],
          },
        },
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(500),
        description: z.string().min(1).max(5000),
        recommendation: z.string().max(5000).optional(),
        type: lessonTypeSchema.default("problem"),
        discipline: lessonDisciplineSchema.default("other"),
        projectPhase: projectPhaseSchema.optional(),
        workPackageId: z.string().uuid().optional(),
        interfacePointIds: z.array(z.string().uuid()).optional(),
        ownershipState: lessonOwnershipStateSchema.default("permissive"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      await ensureWorkPackageInProject(input.projectId, input.workPackageId);
      await ensurePointsInProject(input.projectId, input.interfacePointIds ?? []);

      const [lesson] = await db
        .insert(lessonsLearned)
        .values({
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          recommendation: input.recommendation ?? null,
          type: input.type,
          discipline: input.discipline,
          projectPhase: input.projectPhase ?? null,
          workPackageId: input.workPackageId ?? null,
          ownershipState: input.ownershipState,
          status: "draft",
          authorId: ctx.user.id,
          updatedAt: new Date(),
        })
        .returning();

      if ((input.interfacePointIds?.length ?? 0) > 0) {
        await db.insert(lessonLearnedPoints).values(
          (input.interfacePointIds ?? []).map((interfacePointId) => ({
            lessonId: lesson.id,
            interfacePointId,
            linkedBy: ctx.user.id,
          }))
        );
      }

      return lesson;
    }),

  updateDraft: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().min(1).max(5000).optional(),
        recommendation: z.string().max(5000).nullable().optional(),
        type: lessonTypeSchema.optional(),
        discipline: lessonDisciplineSchema.optional(),
        projectPhase: projectPhaseSchema.nullable().optional(),
        workPackageId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const lesson = await db.query.lessonsLearned.findFirst({
        where: eq(lessonsLearned.id, input.id),
      });
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const role = await getProjectRole(ctx.user.id, lesson.projectId);
      if (!role) throw new TRPCError({ code: "FORBIDDEN" });
      const isOwner = lesson.authorId === ctx.user.id;
      const canModerate = isEditorOrAdmin(role);
      if (!isOwner && !canModerate) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only author, editor, or admin can edit drafts" });
      }
      if (lesson.status !== "draft") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only draft lessons can be edited" });
      }

      await ensureWorkPackageInProject(lesson.projectId, input.workPackageId);

      const { id, ...patch } = input;
      const [updated] = await db
        .update(lessonsLearned)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(lessonsLearned.id, id))
        .returning();

      return updated;
    }),

  setOwnershipState: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        ownershipState: lessonOwnershipStateSchema,
        rationale: z.string().min(1).max(4000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await requireRole(ctx.user.id, projectId, "editor");

      const [updated] = await db
        .update(lessonsLearned)
        .set({
          ownershipState: input.ownershipState,
          ownershipChangedById: ctx.user.id,
          ownershipChangedAt: new Date(),
          ownershipRationale: input.rationale ?? null,
          updatedAt: new Date(),
        })
        .where(eq(lessonsLearned.id, input.id))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return updated;
    }),

  validate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await requireRole(ctx.user.id, projectId, "editor");

      const [updated] = await db
        .update(lessonsLearned)
        .set({
          status: "validated",
          validatedById: ctx.user.id,
          validatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(lessonsLearned.id, input.id), eq(lessonsLearned.status, "draft")))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Lesson must be in draft status to validate",
        });
      }
      return updated;
    }),

  consolidate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await requireRole(ctx.user.id, projectId, "admin");

      const [updated] = await db
        .update(lessonsLearned)
        .set({
          status: "consolidated",
          consolidatedById: ctx.user.id,
          consolidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(lessonsLearned.id, input.id), eq(lessonsLearned.status, "validated")))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only validated lessons can be consolidated",
        });
      }
      return updated;
    }),

  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await requireRole(ctx.user.id, projectId, "admin");

      const [updated] = await db
        .update(lessonsLearned)
        .set({
          status: "closed",
          consolidatedById: ctx.user.id,
          consolidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(lessonsLearned.id, input.id), eq(lessonsLearned.status, "validated")))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only validated lessons can be closed",
        });
      }
      return updated;
    }),

  deleteDraft: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const lesson = await db.query.lessonsLearned.findFirst({
        where: eq(lessonsLearned.id, input.id),
      });
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const role = await getProjectRole(ctx.user.id, lesson.projectId);
      if (!role) throw new TRPCError({ code: "FORBIDDEN" });
      const isOwner = lesson.authorId === ctx.user.id;
      const canModerate = isEditorOrAdmin(role);
      if (!isOwner && !canModerate) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only author, editor, or admin can delete drafts" });
      }
      if (lesson.status !== "draft") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Only draft lessons can be deleted" });
      }

      await db.delete(lessonsLearned).where(eq(lessonsLearned.id, input.id));
      return { success: true };
    }),

  setLinkedPoints: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        interfacePointIds: z.array(z.string().uuid()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const lesson = await db.query.lessonsLearned.findFirst({
        where: eq(lessonsLearned.id, input.id),
      });
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });

      const role = await getProjectRole(ctx.user.id, lesson.projectId);
      if (!role) throw new TRPCError({ code: "FORBIDDEN" });
      const isOwner = lesson.authorId === ctx.user.id;
      const canModerate = isEditorOrAdmin(role);

      if (lesson.status === "draft") {
        if (!isOwner && !canModerate) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only author, editor, or admin can edit draft links" });
        }
      } else {
        if (!canModerate) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only editor or admin can update links after validation" });
        }
      }

      await ensurePointsInProject(lesson.projectId, input.interfacePointIds);

      await db.transaction(async (tx) => {
        await tx.delete(lessonLearnedPoints).where(eq(lessonLearnedPoints.lessonId, lesson.id));
        if (input.interfacePointIds.length > 0) {
          await tx.insert(lessonLearnedPoints).values(
            input.interfacePointIds.map((interfacePointId) => ({
              lessonId: lesson.id,
              interfacePointId,
              linkedBy: ctx.user.id,
            }))
          );
        }
      });

      return { success: true };
    }),

  proposeValidatedUpdate: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().min(1).max(5000).optional(),
        recommendation: z.string().max(5000).nullable().optional(),
        type: lessonTypeSchema.optional(),
        discipline: lessonDisciplineSchema.optional(),
        projectPhase: projectPhaseSchema.nullable().optional(),
        workPackageId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const lesson = await db.query.lessonsLearned.findFirst({
        where: eq(lessonsLearned.id, input.id),
      });
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
      await assertMember(ctx.user.id, lesson.projectId);

      if (lesson.status !== "validated") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only validated lessons can be proposed for review",
        });
      }

      const pending = await db.query.lessonLearnedChangeRequests.findFirst({
        where: and(
          eq(lessonLearnedChangeRequests.lessonId, lesson.id),
          eq(lessonLearnedChangeRequests.status, "pending")
        ),
        columns: { id: true },
      });
      if (pending) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "A pending change request already exists for this lesson",
        });
      }

      await ensureWorkPackageInProject(lesson.projectId, input.workPackageId);

      const [request] = await db
        .insert(lessonLearnedChangeRequests)
        .values({
          lessonId: lesson.id,
          projectId: lesson.projectId,
          proposerId: ctx.user.id,
          status: "pending",
          proposedTitle: input.title ?? lesson.title,
          proposedDescription: input.description ?? lesson.description,
          proposedRecommendation:
            input.recommendation === undefined ? lesson.recommendation : input.recommendation,
          proposedType: input.type ?? lesson.type,
          proposedDiscipline: input.discipline ?? lesson.discipline,
          proposedProjectPhase:
            input.projectPhase === undefined ? lesson.projectPhase : input.projectPhase,
          proposedWorkPackageId:
            input.workPackageId === undefined ? lesson.workPackageId : input.workPackageId,
          updatedAt: new Date(),
        })
        .returning();

      await notifyEditorsAndAdmins(
        lesson.projectId,
        ctx.user.id,
        `Lesson "${lesson.title}" has a pending change request.`,
        lesson.id
      );

      return request;
    }),

  listPendingReviews: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      return db.query.lessonLearnedChangeRequests.findMany({
        where: and(
          eq(lessonLearnedChangeRequests.projectId, input.projectId),
          eq(lessonLearnedChangeRequests.status, "pending")
        ),
        with: {
          lesson: {
            columns: {
              id: true,
              title: true,
              description: true,
              type: true,
              discipline: true,
              projectPhase: true,
              workPackageId: true,
              updatedAt: true,
            },
          },
          proposedWorkPackage: {
            columns: { id: true, code: true, name: true, color: true },
          },
        },
        orderBy: [desc(lessonLearnedChangeRequests.createdAt)],
      });
    }),

  reviewProposedUpdate: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        decision: changeRequestStatusSchema.refine((value) => value !== "pending", {
          message: "Decision must be approved or rejected",
        }),
        reviewNote: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const request = await db.query.lessonLearnedChangeRequests.findFirst({
        where: eq(lessonLearnedChangeRequests.id, input.id),
      });
      if (!request) throw new TRPCError({ code: "NOT_FOUND" });
      await requireRole(ctx.user.id, request.projectId, "editor");

      if (request.status !== "pending") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Request is already resolved" });
      }

      const result = await db.transaction(async (tx) => {
        const [updatedRequest] = await tx
          .update(lessonLearnedChangeRequests)
          .set({
            status: input.decision,
            reviewerId: ctx.user.id,
            reviewedAt: new Date(),
            reviewNote: input.reviewNote ?? null,
            updatedAt: new Date(),
          })
          .where(eq(lessonLearnedChangeRequests.id, request.id))
          .returning();

        if (input.decision === "approved") {
          await tx
            .update(lessonsLearned)
            .set({
              title: request.proposedTitle,
              description: request.proposedDescription,
              recommendation: request.proposedRecommendation,
              type: request.proposedType,
              discipline: request.proposedDiscipline,
              projectPhase: request.proposedProjectPhase,
              workPackageId: request.proposedWorkPackageId,
              updatedAt: new Date(),
            })
            .where(eq(lessonsLearned.id, request.lessonId));
        }

        return updatedRequest;
      });

      await db.insert(notifications).values({
        userId: request.proposerId,
        type: input.decision === "approved" ? "lesson_review_approved" : "lesson_review_rejected",
        referenceType: "lesson_learned",
        referenceId: request.lessonId,
        message:
          input.decision === "approved"
            ? "Your lesson change request was approved."
            : "Your lesson change request was rejected.",
      });

      return result;
    }),
});
