import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  actionAssignments,
  corporateRecommendedActions,
  db,
  lessonAuditLog,
  lessonCategories,
  lessonClusterLinksV2,
  lessonClustersV2,
  lessonEvidence,
  lessonsV2,
  projectActions,
  projectMembers,
  recommendedActions,
} from "@owit/db";
import {
  CONFIDENTIALITY_LEVELS,
  LESSON_CLUSTER_STATUSES,
  LESSON_TYPES,
  LESSON_V2_STATUSES,
  PROJECT_ACTION_STATUSES,
  PROJECT_PHASES,
  RECOMMENDED_ACTION_STATUSES,
  REUSABILITY_LEVELS,
} from "@owit/shared";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import {
  assertProjectActionV2TransitionRequirements,
  assertLessonV2Transition,
  type ProjectActionV2Status,
} from "@/server/lib/lesson-v2-workflow";
import {
  requireV2CorporateCapabilityForUser,
  requireV2ProjectCapability,
} from "@/server/lib/lesson-v2-rbac";
import {
  assertCorporateTransferAllowed,
  buildLessonV2AuditEvent,
  createProjectActionCopyFromCorporate,
  type CorporateTransferChecklist,
} from "@/server/lib/lesson-v2-transfer";

const lessonStatusSchema = z.enum(LESSON_V2_STATUSES);
const lessonTypeSchema = z.enum(LESSON_TYPES);
const lessonClusterStatusSchema = z.enum(LESSON_CLUSTER_STATUSES);
const recommendedActionStatusSchema = z.enum(RECOMMENDED_ACTION_STATUSES);
const projectActionStatusSchema = z.enum(PROJECT_ACTION_STATUSES);
const confidentialitySchema = z.enum(CONFIDENTIALITY_LEVELS);
const reusabilitySchema = z.enum(REUSABILITY_LEVELS);
const projectPhaseSchema = z.enum(PROJECT_PHASES);

async function audit(input: Parameters<typeof buildLessonV2AuditEvent>[0]) {
  await db
    .insert(lessonAuditLog)
    .values(buildLessonV2AuditEvent(input) as typeof lessonAuditLog.$inferInsert);
}

async function assertCategoryExists(categoryId: string) {
  const category = await db.query.lessonCategories.findFirst({
    where: and(eq(lessonCategories.id, categoryId), eq(lessonCategories.active, true)),
    columns: { id: true },
  });
  if (!category) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Category does not exist" });
  }
}

async function assertProjectMember(projectId: string, userId: string) {
  const member = await db.query.projectMembers.findFirst({
    where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
    columns: { id: true },
  });
  if (!member) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Owner must be a project member" });
  }
}

async function getLessonInProject(projectId: string, lessonId: string) {
  const lesson = await db.query.lessonsV2.findFirst({
    where: and(eq(lessonsV2.id, lessonId), eq(lessonsV2.projectId, projectId)),
  });
  if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
  return lesson;
}

async function getRecommendedActionInProject(projectId: string, actionId: string) {
  const action = await db.query.recommendedActions.findFirst({
    where: and(eq(recommendedActions.id, actionId), eq(recommendedActions.projectId, projectId)),
  });
  if (!action) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recommended action not found" });
  }
  return action;
}

export const lessonV2Router = createTRPCRouter({
  listCategories: protectedProcedure.query(async () => {
    return db.query.lessonCategories.findMany({
      where: eq(lessonCategories.active, true),
      orderBy: [lessonCategories.sortOrder, lessonCategories.name],
    });
  }),

  createCategory: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1).max(120), sortOrder: z.number().int().default(0) }))
    .mutation(async ({ input, ctx }) => {
      await requireV2CorporateCapabilityForUser(ctx.user.id, "administer_platform");
      const [category] = await db
        .insert(lessonCategories)
        .values({ name: input.name, sortOrder: input.sortOrder })
        .returning();
      await audit({
        entityType: "category",
        entityId: category.id,
        eventType: "created",
        actorId: ctx.user.id,
        newValue: category,
      });
      return category;
    }),

  listLessons: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: lessonStatusSchema.optional(),
        categoryId: z.string().uuid().optional(),
        search: z.string().trim().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "access_project");
      return db.query.lessonsV2.findMany({
        where: and(
          eq(lessonsV2.projectId, input.projectId),
          input.status ? eq(lessonsV2.status, input.status) : undefined,
          input.categoryId ? eq(lessonsV2.categoryId, input.categoryId) : undefined,
          input.search
            ? or(
                ilike(lessonsV2.title, `%${input.search}%`),
                ilike(lessonsV2.description, `%${input.search}%`)
              )
            : undefined
        ),
        with: {
          category: true,
          workstream: true,
          gate: true,
        },
        orderBy: [desc(lessonsV2.createdAt)],
      });
    }),

  createLesson: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1),
        type: lessonTypeSchema.default("problem"),
        categoryId: z.string().uuid(),
        observedDate: z.string().date().optional(),
        workstreamId: z.string().uuid().optional(),
        packageRef: z.string().trim().optional(),
        projectPhase: projectPhaseSchema.optional(),
        gateId: z.string().uuid().optional(),
        impactLevel: z.string().trim().optional(),
        rootCause: z.string().trim().optional(),
        sourceOrganisation: z.string().trim().optional(),
        tags: z.array(z.string().trim().min(1)).default([]),
        confidentialityLevel: confidentialitySchema.default("internal"),
        submit: z.boolean().default(false),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "create_lesson");
      await assertCategoryExists(input.categoryId);
      const status = input.submit ? "submitted" : "draft";
      const [lesson] = await db
        .insert(lessonsV2)
        .values({
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          type: input.type,
          categoryId: input.categoryId,
          authorId: ctx.user.id,
          observedDate: input.observedDate,
          workstreamId: input.workstreamId,
          packageRef: input.packageRef,
          projectPhase: input.projectPhase,
          gateId: input.gateId,
          impactLevel: input.impactLevel,
          rootCause: input.rootCause,
          sourceOrganisation: input.sourceOrganisation,
          tags: input.tags,
          confidentialityLevel: input.confidentialityLevel,
          status,
        })
        .returning();
      await audit({
        entityType: "lesson",
        entityId: lesson.id,
        eventType: input.submit ? "created_and_submitted" : "created",
        actorId: ctx.user.id,
        projectId: input.projectId,
        newValue: lesson,
      });
      return lesson;
    }),

  submitLesson: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), lessonId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const lesson = await getLessonInProject(input.projectId, input.lessonId);
      if (lesson.authorId !== ctx.user.id) {
        await requireV2ProjectCapability(input.projectId, ctx.user.id, "edit_any_lesson");
      }
      assertLessonV2Transition("lesson", lesson.status, "submitted");
      const [updated] = await db
        .update(lessonsV2)
        .set({ status: "submitted", updatedAt: new Date() })
        .where(eq(lessonsV2.id, input.lessonId))
        .returning();
      await audit({
        entityType: "lesson",
        entityId: input.lessonId,
        eventType: "status_changed",
        actorId: ctx.user.id,
        projectId: input.projectId,
        previousValue: { status: lesson.status },
        newValue: { status: "submitted" },
      });
      return updated;
    }),

  decideLesson: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        lessonId: z.string().uuid(),
        decision: z.enum(["start_review", "validate", "reject", "return"]),
        note: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "validate_lesson");
      const lesson = await getLessonInProject(input.projectId, input.lessonId);
      const nextStatus = {
        start_review: "under_review",
        validate: "validated",
        reject: "rejected",
        return: "draft",
      }[input.decision] as "under_review" | "validated" | "rejected" | "draft";
      if (["reject", "return"].includes(input.decision) && !input.note) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Decision note is required" });
      }
      assertLessonV2Transition("lesson", lesson.status, nextStatus);
      const [updated] = await db
        .update(lessonsV2)
        .set({
          status: nextStatus,
          validatedById: nextStatus === "validated" ? ctx.user.id : lesson.validatedById,
          validatedAt: nextStatus === "validated" ? new Date() : lesson.validatedAt,
          updatedAt: new Date(),
        })
        .where(eq(lessonsV2.id, input.lessonId))
        .returning();
      await audit({
        entityType: "lesson",
        entityId: input.lessonId,
        eventType: `lesson_${input.decision}`,
        actorId: ctx.user.id,
        projectId: input.projectId,
        previousValue: { status: lesson.status },
        newValue: { status: nextStatus },
        note: input.note,
      });
      return updated;
    }),

  createCluster: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        name: z.string().trim().min(1).max(180),
        summary: z.string().trim().min(1),
        lessonIds: z.array(z.string().uuid()).min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "create_cluster");
      const lessons = await db.query.lessonsV2.findMany({
        where: and(eq(lessonsV2.projectId, input.projectId), inArray(lessonsV2.id, input.lessonIds)),
        columns: { id: true, status: true },
      });
      if (lessons.length !== input.lessonIds.length || lessons.some((lesson) => lesson.status !== "validated")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only validated project lessons can be clustered" });
      }
      const [cluster] = await db
        .insert(lessonClustersV2)
        .values({
          projectId: input.projectId,
          name: input.name,
          summary: input.summary,
          createdById: ctx.user.id,
        })
        .returning();
      await db.insert(lessonClusterLinksV2).values(
        input.lessonIds.map((lessonId) => ({
          clusterId: cluster.id,
          lessonId,
          addedById: ctx.user.id,
        }))
      );
      await audit({
        entityType: "lesson_cluster",
        entityId: cluster.id,
        eventType: "created",
        actorId: ctx.user.id,
        projectId: input.projectId,
        newValue: { ...cluster, lessonIds: input.lessonIds },
      });
      return cluster;
    }),

  listClusters: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: lessonClusterStatusSchema.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "access_project");
      return db.query.lessonClustersV2.findMany({
        where: and(
          eq(lessonClustersV2.projectId, input.projectId),
          input.status ? eq(lessonClustersV2.status, input.status) : undefined
        ),
        with: {
          clusterLinks: true,
          workstream: true,
        },
        orderBy: [desc(lessonClustersV2.createdAt)],
      });
    }),

  createRecommendedAction: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().trim().min(1).max(220),
        actionDescription: z.string().trim().min(1),
        implementationGuidance: z.string().trim().optional(),
        categoryId: z.string().uuid(),
        sourceLessonId: z.string().uuid().optional(),
        sourceClusterId: z.string().uuid().optional(),
        reusabilityLevel: reusabilitySchema.default("project_specific"),
        confidentialityLevel: confidentialitySchema.default("internal"),
        tags: z.array(z.string().trim().min(1)).default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "create_recommended_action");
      if ((input.sourceLessonId ? 1 : 0) + (input.sourceClusterId ? 1 : 0) !== 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose exactly one source lesson or cluster" });
      }
      await assertCategoryExists(input.categoryId);
      if (input.sourceLessonId) {
        const lesson = await getLessonInProject(input.projectId, input.sourceLessonId);
        if (lesson.status !== "validated") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Source lesson must be validated" });
        }
      }
      if (input.sourceClusterId) {
        const cluster = await db.query.lessonClustersV2.findFirst({
          where: and(eq(lessonClustersV2.id, input.sourceClusterId), eq(lessonClustersV2.projectId, input.projectId)),
          columns: { id: true, status: true },
        });
        if (!cluster || cluster.status !== "approved") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Source cluster must be approved" });
        }
      }
      const [action] = await db
        .insert(recommendedActions)
        .values({
          projectId: input.projectId,
          title: input.title,
          actionDescription: input.actionDescription,
          implementationGuidance: input.implementationGuidance,
          categoryId: input.categoryId,
          sourceLessonId: input.sourceLessonId,
          sourceClusterId: input.sourceClusterId,
          reusabilityLevel: input.reusabilityLevel,
          confidentialityLevel: input.confidentialityLevel,
          tags: input.tags,
          createdById: ctx.user.id,
        })
        .returning();
      await audit({
        entityType: "recommended_action",
        entityId: action.id,
        eventType: "created",
        actorId: ctx.user.id,
        projectId: input.projectId,
        newValue: action,
      });
      return action;
    }),

  approveRecommendedAction: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), recommendedActionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "approve_recommended_action");
      const action = await getRecommendedActionInProject(input.projectId, input.recommendedActionId);
      assertLessonV2Transition("recommended_action", action.status, "project_approved");
      const [updated] = await db
        .update(recommendedActions)
        .set({
          status: "project_approved",
          approvedById: ctx.user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(recommendedActions.id, input.recommendedActionId))
        .returning();
      await audit({
        entityType: "recommended_action",
        entityId: input.recommendedActionId,
        eventType: "project_approved",
        actorId: ctx.user.id,
        projectId: input.projectId,
        previousValue: { status: action.status },
        newValue: { status: "project_approved" },
      });
      return updated;
    }),

  listRecommendedActions: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: recommendedActionStatusSchema.optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "access_project");
      return db.query.recommendedActions.findMany({
        where: and(
          eq(recommendedActions.projectId, input.projectId),
          input.status ? eq(recommendedActions.status, input.status) : undefined
        ),
        with: {
          category: true,
          sourceLesson: true,
          sourceCluster: true,
        },
        orderBy: [desc(recommendedActions.createdAt)],
      });
    }),

  spawnProjectActionFromRecommendation: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), recommendedActionId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "approve_recommended_action");
      const action = await getRecommendedActionInProject(input.projectId, input.recommendedActionId);
      if (action.status !== "project_approved" && action.status !== "corporate_approved") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Recommended action must be approved before project implementation",
        });
      }
      const [projectAction] = await db
        .insert(projectActions)
        .values({
          projectId: input.projectId,
          title: action.title,
          actionDescription: action.actionDescription,
          implementationGuidance: action.implementationGuidance,
          categoryId: action.categoryId,
          sourceRecommendedActionId: action.id,
          tags: action.tags,
          createdById: ctx.user.id,
        })
        .returning();
      await audit({
        entityType: "project_action",
        entityId: projectAction.id,
        eventType: "spawned_from_recommended_action",
        actorId: ctx.user.id,
        projectId: input.projectId,
        newValue: {
          projectActionId: projectAction.id,
          sourceRecommendedActionId: action.id,
        },
      });
      return projectAction;
    }),

  proposeCorporateTransfer: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        recommendedActionId: z.string().uuid(),
        checklist: z.record(z.string(), z.boolean()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "propose_corporate_transfer");
      const action = await getRecommendedActionInProject(input.projectId, input.recommendedActionId);
      assertLessonV2Transition("recommended_action", action.status, "proposed_for_corporate");
      assertCorporateTransferAllowed(
        action.confidentialityLevel,
        input.checklist as Partial<CorporateTransferChecklist> | undefined
      );
      const [updated] = await db
        .update(recommendedActions)
        .set({
          status: "proposed_for_corporate",
          isCorporateCandidate: true,
          transferChecklist: input.checklist ?? null,
          transferProposedById: ctx.user.id,
          transferProposedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(recommendedActions.id, input.recommendedActionId))
        .returning();
      await audit({
        entityType: "recommended_action",
        entityId: input.recommendedActionId,
        eventType: "proposed_for_corporate",
        actorId: ctx.user.id,
        projectId: input.projectId,
        previousValue: { status: action.status },
        newValue: { status: "proposed_for_corporate", checklist: input.checklist ?? null },
      });
      return updated;
    }),

  approveCorporateProposal: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        recommendedActionId: z.string().uuid(),
        title: z.string().trim().min(1).max(220).optional(),
        actionDescription: z.string().trim().min(1).optional(),
        implementationGuidance: z.string().trim().optional(),
        originSummary: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireV2CorporateCapabilityForUser(ctx.user.id, "publish_corporate_action");
      const action = await getRecommendedActionInProject(input.projectId, input.recommendedActionId);
      const reviewFrom = action.status === "proposed_for_corporate" ? "corporate_review" : action.status;
      if (action.status === "proposed_for_corporate") {
        assertLessonV2Transition("recommended_action", action.status, "corporate_review");
      }
      assertLessonV2Transition("recommended_action", reviewFrom, "corporate_approved");
      const [corporateAction] = await db
        .insert(corporateRecommendedActions)
        .values({
          title: input.title ?? action.title,
          actionDescription: input.actionDescription ?? action.actionDescription,
          implementationGuidance: input.implementationGuidance ?? action.implementationGuidance,
          categoryId: action.categoryId,
          reusabilityLevel: action.reusabilityLevel,
          sourceRecommendedActionId: action.id,
          sourceProjectId: action.projectId,
          originSummary: input.originSummary ?? null,
          publishedById: ctx.user.id,
        })
        .returning();
      await db
        .update(recommendedActions)
        .set({
          status: "corporate_approved",
          corporateActionId: corporateAction.id,
          corporateReviewById: ctx.user.id,
          corporateReviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(recommendedActions.id, action.id));
      await audit({
        entityType: "corporate_recommended_action",
        entityId: corporateAction.id,
        eventType: "published",
        actorId: ctx.user.id,
        projectId: action.projectId,
        newValue: corporateAction,
      });
      return corporateAction;
    }),

  listCorporateLibrary: protectedProcedure
    .input(z.object({ search: z.string().trim().optional(), includeRetired: z.boolean().default(false) }).optional())
    .query(async ({ input, ctx }) => {
      const role = await requireV2CorporateCapabilityForUser(ctx.user.id, "browse_corporate_library");
      const rows = await db.query.corporateRecommendedActions.findMany({
        where: and(
          input?.includeRetired ? undefined : inArray(corporateRecommendedActions.status, ["active", "under_review"]),
          input?.search
            ? or(
                ilike(corporateRecommendedActions.title, `%${input.search}%`),
                ilike(corporateRecommendedActions.actionDescription, `%${input.search}%`)
              )
            : undefined
        ),
        with: { category: true },
        orderBy: [desc(corporateRecommendedActions.publishedAt)],
      });
      const canSeeSourceProject = role === "corporate_ll_manager" || role === "senior_management";
      return rows.map((row) => ({
        ...row,
        sourceProjectId: canSeeSourceProject ? row.sourceProjectId : null,
      }));
    }),

  listEligibleProjectsForCorporateAdd: protectedProcedure.query(async ({ ctx }) => {
    await requireV2CorporateCapabilityForUser(ctx.user.id, "browse_corporate_library");
    const memberships = await db.query.projectMembers.findMany({
      where: and(
        eq(projectMembers.userId, ctx.user.id),
        inArray(projectMembers.role, ["admin", "editor"])
      ),
      columns: { id: true, projectId: true, role: true },
      with: {
        project: {
          columns: { id: true, name: true, status: true },
        },
      },
      orderBy: [desc(projectMembers.createdAt)],
    });
    return memberships
      .filter((membership) => membership.project.status === "active")
      .map((membership) => ({
        id: membership.project.id,
        name: membership.project.name,
        role: membership.role,
      }));
  }),

  addCorporateActionToProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        corporateActionId: z.string().uuid(),
        duplicateOverrideReason: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "add_corporate_action_to_project");
      const corporateAction = await db.query.corporateRecommendedActions.findFirst({
        where: eq(corporateRecommendedActions.id, input.corporateActionId),
      });
      if (!corporateAction || corporateAction.status === "retired") {
        throw new TRPCError({ code: "NOT_FOUND", message: "Corporate action is not available" });
      }
      const [existing] = await db
        .select({ count: count() })
        .from(projectActions)
        .where(
          and(
            eq(projectActions.projectId, input.projectId),
            eq(projectActions.sourceCorporateActionId, input.corporateActionId),
            sql`${projectActions.status} <> 'cancelled'`
          )
        );
      if ((existing?.count ?? 0) > 0 && !input.duplicateOverrideReason) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Corporate action already exists in this project",
        });
      }
      const [projectAction] = await db
        .insert(projectActions)
        .values(
          createProjectActionCopyFromCorporate({
            projectId: input.projectId,
            createdById: ctx.user.id,
            duplicateOverrideReason: input.duplicateOverrideReason,
            corporateAction: {
              id: corporateAction.id,
              version: corporateAction.version,
              title: corporateAction.title,
              actionDescription: corporateAction.actionDescription,
              implementationGuidance: corporateAction.implementationGuidance,
              categoryId: corporateAction.categoryId,
              tags: corporateAction.tags,
            },
          })
        )
        .returning();
      await audit({
        entityType: "project_action",
        entityId: projectAction.id,
        eventType: "added_from_corporate",
        actorId: ctx.user.id,
        projectId: input.projectId,
        newValue: {
          projectActionId: projectAction.id,
          sourceCorporateActionId: corporateAction.id,
          sourceVersion: corporateAction.version,
          duplicateOverrideReason: input.duplicateOverrideReason ?? null,
        },
      });
      return projectAction;
    }),

  listProjectActions: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        status: projectActionStatusSchema.optional(),
        ownerId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "access_project");
      return db.query.projectActions.findMany({
        where: and(
          eq(projectActions.projectId, input.projectId),
          input.status ? eq(projectActions.status, input.status) : undefined,
          input.ownerId ? eq(projectActions.currentOwnerId, input.ownerId) : undefined
        ),
        with: {
          category: true,
          sourceCorporateAction: true,
          sourceRecommendedAction: true,
          assignments: true,
        },
        orderBy: [desc(projectActions.createdAt)],
      });
    }),

  assignProjectAction: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        projectActionId: z.string().uuid(),
        ownerId: z.string().uuid(),
        deadline: z.string().date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "assign_project_action");
      await assertProjectMember(input.projectId, input.ownerId);
      const action = await db.query.projectActions.findFirst({
        where: and(eq(projectActions.id, input.projectActionId), eq(projectActions.projectId, input.projectId)),
      });
      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Project action not found" });
      assertProjectActionV2TransitionRequirements(action.status, "assigned", {
        ownerUserId: input.ownerId,
        deadline: input.deadline,
      });
      const now = new Date();
      const [updated] = await db
        .update(projectActions)
        .set({
          status: "assigned",
          currentOwnerId: input.ownerId,
          deadline: input.deadline,
          updatedAt: now,
        })
        .where(eq(projectActions.id, input.projectActionId))
        .returning();
      await db
        .update(actionAssignments)
        .set({ supersededAt: now })
        .where(and(eq(actionAssignments.projectActionId, input.projectActionId), sql`${actionAssignments.supersededAt} IS NULL`));
      await db.insert(actionAssignments).values({
        projectId: input.projectId,
        projectActionId: input.projectActionId,
        ownerId: input.ownerId,
        assignedById: ctx.user.id,
        deadlineAtAssignment: input.deadline,
      });
      await audit({
        entityType: "project_action",
        entityId: input.projectActionId,
        eventType: "assigned",
        actorId: ctx.user.id,
        projectId: input.projectId,
        previousValue: { ownerId: action.currentOwnerId, deadline: action.deadline, status: action.status },
        newValue: { ownerId: input.ownerId, deadline: input.deadline, status: "assigned" },
      });
      return updated;
    }),

  transitionProjectAction: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        projectActionId: z.string().uuid(),
        toStatus: projectActionStatusSchema,
        note: z.string().trim().optional(),
        blockedReason: z.string().trim().optional(),
        cancellationReason: z.string().trim().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const action = await db.query.projectActions.findFirst({
        where: and(eq(projectActions.id, input.projectActionId), eq(projectActions.projectId, input.projectId)),
      });
      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Project action not found" });
      if (["verified", "closed", "cancelled"].includes(input.toStatus)) {
        await requireV2ProjectCapability(input.projectId, ctx.user.id, "verify_project_action");
      } else if (action.currentOwnerId !== ctx.user.id) {
        await requireV2ProjectCapability(input.projectId, ctx.user.id, "assign_project_action");
      }
      const [evidence] = await db
        .select({ count: count() })
        .from(lessonEvidence)
        .where(and(eq(lessonEvidence.entityType, "project_action"), eq(lessonEvidence.entityId, input.projectActionId)));
      assertProjectActionV2TransitionRequirements(
        action.status,
        input.toStatus as ProjectActionV2Status,
        {
          ownerUserId: action.currentOwnerId,
          actorUserId: ctx.user.id,
          verifierUserId: input.toStatus === "verified" ? ctx.user.id : undefined,
          blockedReason: input.blockedReason,
          cancellationReason: input.cancellationReason,
          evidenceCount: evidence?.count ?? 0,
        }
      );
      const [updated] = await db
        .update(projectActions)
        .set({
          status: input.toStatus,
          blockedReason: input.toStatus === "blocked" ? input.blockedReason : action.blockedReason,
          verifiedById: input.toStatus === "verified" ? ctx.user.id : action.verifiedById,
          verifiedAt: input.toStatus === "verified" ? new Date() : action.verifiedAt,
          closedById: input.toStatus === "closed" ? ctx.user.id : action.closedById,
          closedAt: input.toStatus === "closed" ? new Date() : action.closedAt,
          cancelledReason: input.toStatus === "cancelled" ? input.cancellationReason : action.cancelledReason,
          updatedAt: new Date(),
        })
        .where(eq(projectActions.id, input.projectActionId))
        .returning();
      await audit({
        entityType: "project_action",
        entityId: input.projectActionId,
        eventType: "status_changed",
        actorId: ctx.user.id,
        projectId: input.projectId,
        previousValue: { status: action.status },
        newValue: { status: input.toStatus },
        note: input.note,
      });
      return updated;
    }),
});
