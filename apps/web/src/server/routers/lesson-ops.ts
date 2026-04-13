import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  lessonActionEvidence,
  lessonClusterItems,
  lessonClusters,
  lessonCycles,
  lessonPolicyProfiles,
  lessonTriageDecisions,
  lessonTrackAActions,
  lessonTrackBEscalations,
  lessonsLearned,
  notifications,
  projectLessonPolicyAssignments,
  projects,
} from "@owit/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { requireLessonRole } from "@/server/lib/lesson-rbac";
import {
  calculateTrackAApprovalLevel,
  deriveCycleMilestones,
  workflowAfterTriage,
} from "@/server/lib/lesson-workflow";

const triageDecisionSchema = z.enum([
  "retain",
  "drop",
  "defer",
  "hold",
  "duplicate",
  "external_context",
]);
const cycleTypeSchema = z.enum(["monthly", "pre_gate", "ad_hoc"]);
const cycleStateSchema = z.enum(["planned", "active", "completed", "archived"]);
const actionPrioritySchema = z.enum(["do", "delay", "delegate", "drop"]);
const actionStatusSchema = z.enum(["not_started", "in_progress", "done", "overdue"]);
const escalationStatusSchema = z.enum([
  "draft",
  "submitted",
  "acknowledged",
  "assigned",
  "closed",
]);

async function getProject(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: { id: true, portfolioId: true, name: true },
  });
  if (!project) throw new TRPCError({ code: "NOT_FOUND" });
  return project;
}

async function getPolicyProfile(projectId: string) {
  const project = await getProject(projectId);
  const assignment = await db.query.projectLessonPolicyAssignments.findFirst({
    where: eq(projectLessonPolicyAssignments.projectId, projectId),
    with: {
      policyProfile: true,
    },
  });
  if (assignment?.policyProfile) {
    return assignment.policyProfile;
  }

  const profile = await db.query.lessonPolicyProfiles.findFirst({
    where: and(
      eq(lessonPolicyProfiles.portfolioId, project.portfolioId),
      eq(lessonPolicyProfiles.active, true)
    ),
    orderBy: [desc(lessonPolicyProfiles.updatedAt)],
  });

  if (profile) return profile;

  const [created] = await db
    .insert(lessonPolicyProfiles)
    .values({
      portfolioId: project.portfolioId,
      name: "Default Policy",
      trackAApprovalEur250k: 250000,
      trackAApprovalEur1m: 1000000,
      monthlyTriageDay: 1,
      preGateLeadWeeks: 6,
      reminderSlaDays: 5,
      active: true,
    })
    .returning();

  return created;
}

async function computeGateReadiness(projectId: string) {
  const lessons = await db.query.lessonsLearned.findMany({
    where: eq(lessonsLearned.projectId, projectId),
    columns: { id: true, workflowState: true },
  });

  const triaged = lessons.filter((row) => row.workflowState !== "ingested").length;
  const clustered = lessons.filter((row) => ["clustered", "classified", "actioned", "report_ready"].includes(row.workflowState)).length;
  const classified = lessons.filter((row) => ["classified", "actioned", "report_ready"].includes(row.workflowState)).length;
  const actioned = lessons.filter((row) => ["actioned", "report_ready"].includes(row.workflowState)).length;
  const reportReady = lessons.filter((row) => row.workflowState === "report_ready").length;

  const trackAWithoutOwner = await db
    .select({ count: count() })
    .from(lessonTrackAActions)
    .where(and(eq(lessonTrackAActions.projectId, projectId), isNull(lessonTrackAActions.ownerUserId)));

  const doneActions = await db.query.lessonTrackAActions.findMany({
    where: and(eq(lessonTrackAActions.projectId, projectId), eq(lessonTrackAActions.status, "done")),
    columns: { id: true },
  });
  const doneIds = doneActions.map((row) => row.id);
  const evidenceCounts = doneIds.length
    ? await db
        .select({ actionId: lessonActionEvidence.actionId, count: count() })
        .from(lessonActionEvidence)
        .where(inArray(lessonActionEvidence.actionId, doneIds))
        .groupBy(lessonActionEvidence.actionId)
    : [];
  const withEvidence = new Set(evidenceCounts.map((row) => row.actionId));
  const doneWithoutEvidence = doneActions.filter((row) => !withEvidence.has(row.id)).length;

  const pendingTrackB = await db
    .select({ count: count() })
    .from(lessonTrackBEscalations)
    .where(
      and(
        eq(lessonTrackBEscalations.projectId, projectId),
        inArray(lessonTrackBEscalations.status, ["draft", "submitted"]) 
      )
    );

  const untriaged = lessons.filter((row) => row.workflowState === "ingested").length;
  const unclassified = lessons.filter((row) => ["ingested", "triaged", "clustered"].includes(row.workflowState)).length;

  const isGateReady =
    untriaged === 0 &&
    unclassified === 0 &&
    (trackAWithoutOwner[0]?.count ?? 0) === 0 &&
    doneWithoutEvidence === 0;

  const activeCycle = await db.query.lessonCycles.findFirst({
    where: and(eq(lessonCycles.projectId, projectId), eq(lessonCycles.state, "active")),
    orderBy: [desc(lessonCycles.createdAt)],
    columns: { id: true, state: true },
  });

  return {
    projectId,
    cycleId: activeCycle?.id ?? null,
    status: activeCycle?.state ?? "none",
    totals: {
      ingested: lessons.length,
      triaged,
      clustered,
      classified,
      actioned,
      reportReady,
    },
    blockers: {
      untriaged,
      unclassified,
      trackAWithoutOwner: trackAWithoutOwner[0]?.count ?? 0,
      trackADoneWithoutEvidence: doneWithoutEvidence,
      pendingTrackBSubmissions: pendingTrackB[0]?.count ?? 0,
    },
    isGateReady,
  };
}

export const lessonOpsRouter = createTRPCRouter({
  listIntake: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      return db.query.lessonsLearned.findMany({
        where: and(
          eq(lessonsLearned.projectId, input.projectId),
          eq(lessonsLearned.workflowState, "ingested")
        ),
        with: {
          linkedPoints: {
            with: {
              interfacePoint: { columns: { id: true, code: true, title: true } },
            },
          },
        },
        orderBy: [desc(lessonsLearned.createdAt)],
      });
    }),

  triage: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        lessonId: z.string().uuid(),
        cycleId: z.string().uuid().optional(),
        decision: triageDecisionSchema,
        rationale: z.string().min(3).max(2000),
        duplicateOfLessonId: z.string().uuid().optional(),
        deferTrigger: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["document_controller", "ll_manager", "pmo_director"]);

      const lesson = await db.query.lessonsLearned.findFirst({
        where: and(eq(lessonsLearned.id, input.lessonId), eq(lessonsLearned.projectId, input.projectId)),
        columns: { id: true, workflowState: true },
      });
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND" });
      if (["clustered", "classified", "actioned", "report_ready"].includes(lesson.workflowState)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Lesson already progressed beyond triage",
        });
      }

      const [decision] = await db
        .insert(lessonTriageDecisions)
        .values({
          projectId: input.projectId,
          cycleId: input.cycleId ?? null,
          lessonId: input.lessonId,
          decision: input.decision,
          rationale: input.rationale,
          duplicateOfLessonId: input.duplicateOfLessonId ?? null,
          deferTrigger: input.deferTrigger ?? null,
          reviewerId: ctx.user.id,
        })
        .onConflictDoUpdate({
          target: [lessonTriageDecisions.lessonId],
          set: {
            decision: input.decision,
            rationale: input.rationale,
            duplicateOfLessonId: input.duplicateOfLessonId ?? null,
            deferTrigger: input.deferTrigger ?? null,
            reviewerId: ctx.user.id,
            decidedAt: new Date(),
          },
        })
        .returning();

      await db
        .update(lessonsLearned)
        .set({ workflowState: workflowAfterTriage(input.decision), updatedAt: new Date() })
        .where(eq(lessonsLearned.id, input.lessonId));

      return decision;
    }),

  bulkTriage: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        cycleId: z.string().uuid().optional(),
        items: z.array(
          z.object({
            lessonId: z.string().uuid(),
            decision: triageDecisionSchema,
            rationale: z.string().min(3).max(2000),
            duplicateOfLessonId: z.string().uuid().optional(),
            deferTrigger: z.string().max(500).optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["document_controller", "ll_manager", "pmo_director"]);
      if (input.items.length === 0) return { updated: 0 };

      await db.transaction(async (tx) => {
        for (const item of input.items) {
          const lesson = await tx.query.lessonsLearned.findFirst({
            where: and(
              eq(lessonsLearned.id, item.lessonId),
              eq(lessonsLearned.projectId, input.projectId)
            ),
            columns: { id: true, workflowState: true },
          });
          if (!lesson) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found in project" });
          }
          if (["clustered", "classified", "actioned", "report_ready"].includes(lesson.workflowState)) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Lesson already progressed beyond triage",
            });
          }

          await tx
            .insert(lessonTriageDecisions)
            .values({
              projectId: input.projectId,
              cycleId: input.cycleId ?? null,
              lessonId: item.lessonId,
              decision: item.decision,
              rationale: item.rationale,
              duplicateOfLessonId: item.duplicateOfLessonId ?? null,
              deferTrigger: item.deferTrigger ?? null,
              reviewerId: ctx.user.id,
            })
            .onConflictDoUpdate({
              target: [lessonTriageDecisions.lessonId],
              set: {
                decision: item.decision,
                rationale: item.rationale,
                duplicateOfLessonId: item.duplicateOfLessonId ?? null,
                deferTrigger: item.deferTrigger ?? null,
                reviewerId: ctx.user.id,
                decidedAt: new Date(),
              },
            });

          await tx
            .update(lessonsLearned)
            .set({ workflowState: workflowAfterTriage(item.decision), updatedAt: new Date() })
            .where(eq(lessonsLearned.id, item.lessonId));
        }
      });

      return { updated: input.items.length };
    }),

  createCluster: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        cycleId: z.string().uuid().optional(),
        packageId: z.string().uuid().optional(),
        clusterName: z.string().min(3).max(255),
        phase: z
          .enum([
            "maturation",
            "feed",
            "detailed_design",
            "procurement",
            "fabrication",
            "installation",
            "commissioning",
            "operations",
          ])
          .optional(),
        rootCause: z.string().max(4000).optional(),
        eventNarrative: z.string().max(4000).optional(),
        impactSummary: z.string().max(2000).optional(),
        impactCostEur: z.number().int().min(0).optional(),
        impactScheduleDays: z.number().int().min(0).optional(),
        isCrossPackage: z.boolean().optional(),
        lessonIds: z.array(z.string().uuid()).default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);

      if (input.lessonIds.length > 0) {
        const [lessons, decisions] = await Promise.all([
          db.query.lessonsLearned.findMany({
            where: and(
              eq(lessonsLearned.projectId, input.projectId),
              inArray(lessonsLearned.id, input.lessonIds)
            ),
            columns: { id: true, workflowState: true },
          }),
          db.query.lessonTriageDecisions.findMany({
            where: inArray(lessonTriageDecisions.lessonId, input.lessonIds),
            columns: { lessonId: true, decision: true },
          }),
        ]);

        if (lessons.length !== input.lessonIds.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Some lessons are missing or do not belong to the selected project",
          });
        }

        const lessonStateById = new Map(lessons.map((row) => [row.id, row.workflowState]));
        const decisionByLessonId = new Map(decisions.map((row) => [row.lessonId, row.decision]));
        for (const lessonId of input.lessonIds) {
          const decision = decisionByLessonId.get(lessonId);
          const workflowState = lessonStateById.get(lessonId);
          if (decision !== "retain") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Only retained lessons can be clustered",
            });
          }
          if (!workflowState || !["triaged", "clustered", "classified"].includes(workflowState)) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Only triaged lessons can move into clustering",
            });
          }
        }
      }

      const [cluster] = await db
        .insert(lessonClusters)
        .values({
          projectId: input.projectId,
          cycleId: input.cycleId ?? null,
          packageId: input.packageId ?? null,
          clusterName: input.clusterName,
          phase: input.phase ?? null,
          rootCause: input.rootCause ?? null,
          eventNarrative: input.eventNarrative ?? null,
          impactSummary: input.impactSummary ?? null,
          impactCostEur: input.impactCostEur ?? null,
          impactScheduleDays: input.impactScheduleDays ?? null,
          isCrossPackage: input.isCrossPackage ?? false,
          createdBy: ctx.user.id,
        })
        .returning();

      if (input.lessonIds.length > 0) {
        await db.insert(lessonClusterItems).values(
          input.lessonIds.map((lessonId) => ({
            projectId: input.projectId,
            clusterId: cluster.id,
            lessonId,
          }))
        );

        await db
          .update(lessonsLearned)
          .set({ workflowState: "clustered", updatedAt: new Date() })
          .where(inArray(lessonsLearned.id, input.lessonIds));
      }

      return cluster;
    }),

  assignCluster: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        clusterId: z.string().uuid(),
        lessonId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);

      const [cluster, lesson, decision] = await Promise.all([
        db.query.lessonClusters.findFirst({
          where: and(eq(lessonClusters.id, input.clusterId), eq(lessonClusters.projectId, input.projectId)),
          columns: { id: true },
        }),
        db.query.lessonsLearned.findFirst({
          where: and(eq(lessonsLearned.id, input.lessonId), eq(lessonsLearned.projectId, input.projectId)),
          columns: { id: true, workflowState: true },
        }),
        db.query.lessonTriageDecisions.findFirst({
          where: eq(lessonTriageDecisions.lessonId, input.lessonId),
          columns: { decision: true },
        }),
      ]);
      if (!cluster) throw new TRPCError({ code: "NOT_FOUND", message: "Cluster not found" });
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      if (decision?.decision !== "retain") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only retained lessons can be assigned to clusters",
        });
      }
      if (!["triaged", "clustered", "classified"].includes(lesson.workflowState)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Lesson must be triaged before cluster assignment",
        });
      }

      const [row] = await db
        .insert(lessonClusterItems)
        .values({
          projectId: input.projectId,
          clusterId: input.clusterId,
          lessonId: input.lessonId,
        })
        .onConflictDoNothing()
        .returning();

      await db
        .update(lessonsLearned)
        .set({ workflowState: "clustered", updatedAt: new Date() })
        .where(eq(lessonsLearned.id, input.lessonId));

      return row ?? { clusterId: input.clusterId, lessonId: input.lessonId };
    }),

  classifyTrack: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        clusterId: z.string().uuid(),
        trackType: z.enum(["A", "B"]),
        trackRationale: z.string().min(5).max(3000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);

      const [updated] = await db
        .update(lessonClusters)
        .set({
          trackType: input.trackType,
          trackRationale: input.trackRationale,
          updatedAt: new Date(),
        })
        .where(and(eq(lessonClusters.id, input.clusterId), eq(lessonClusters.projectId, input.projectId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      const linkedCount = await db
        .select({ count: count() })
        .from(lessonClusterItems)
        .where(eq(lessonClusterItems.clusterId, input.clusterId));
      if ((linkedCount[0]?.count ?? 0) === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Cannot classify an empty cluster",
        });
      }

      const rows = await db.query.lessonClusterItems.findMany({
        where: eq(lessonClusterItems.clusterId, input.clusterId),
        columns: { lessonId: true },
      });
      const lessonIds = rows.map((row) => row.lessonId);
      if (lessonIds.length > 0) {
        await db
          .update(lessonsLearned)
          .set({ workflowState: "classified", updatedAt: new Date() })
          .where(inArray(lessonsLearned.id, lessonIds));
      }

      return updated;
    }),

  createTrackA: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        cycleId: z.string().uuid().optional(),
        lessonId: z.string().uuid(),
        clusterId: z.string().uuid().optional(),
        ownerUserId: z.string().uuid().optional(),
        actionText: z.string().min(5).max(5000),
        successCriteria: z.string().max(3000).optional(),
        dueAt: z.coerce.date().optional(),
        estimatedCostEur: z.number().int().min(0).optional(),
        priority: actionPrioritySchema.optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);
      const policy = await getPolicyProfile(input.projectId);
      const approvalLevel = calculateTrackAApprovalLevel(input.estimatedCostEur, policy);

      const [lesson, cluster] = await Promise.all([
        db.query.lessonsLearned.findFirst({
          where: and(eq(lessonsLearned.id, input.lessonId), eq(lessonsLearned.projectId, input.projectId)),
          columns: { id: true, workflowState: true },
        }),
        input.clusterId
          ? db.query.lessonClusters.findFirst({
              where: and(eq(lessonClusters.id, input.clusterId), eq(lessonClusters.projectId, input.projectId)),
              columns: { id: true, trackType: true },
            })
          : Promise.resolve(null),
      ]);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      if (!["classified", "actioned", "report_ready"].includes(lesson.workflowState)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Lesson must be classified before creating Track A actions",
        });
      }
      if (input.clusterId && !cluster) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cluster not found" });
      }
      if (cluster?.trackType && cluster.trackType !== "A") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Track A actions require a Track A cluster",
        });
      }

      const [row] = await db
        .insert(lessonTrackAActions)
        .values({
          projectId: input.projectId,
          cycleId: input.cycleId ?? null,
          lessonId: input.lessonId,
          clusterId: input.clusterId ?? null,
          ownerUserId: input.ownerUserId ?? null,
          actionText: input.actionText,
          successCriteria: input.successCriteria ?? null,
          dueAt: input.dueAt ?? null,
          estimatedCostEur: input.estimatedCostEur ?? null,
          priority: input.priority ?? "do",
          approvalLevel,
          createdBy: ctx.user.id,
        })
        .returning();

      await db
        .update(lessonsLearned)
        .set({ workflowState: "actioned", updatedAt: new Date() })
        .where(eq(lessonsLearned.id, input.lessonId));

      return row;
    }),

  updateTrackA: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        projectId: z.string().uuid(),
        ownerUserId: z.string().uuid().nullable().optional(),
        status: actionStatusSchema.optional(),
        priority: actionPrioritySchema.optional(),
        actionText: z.string().min(5).max(5000).optional(),
        successCriteria: z.string().max(3000).nullable().optional(),
        dueAt: z.coerce.date().nullable().optional(),
        estimatedCostEur: z.number().int().min(0).nullable().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);

      const policy = await getPolicyProfile(input.projectId);
      const approvalLevel = calculateTrackAApprovalLevel(input.estimatedCostEur ?? undefined, policy);

      const { id, projectId: _projectId, ...patch } = input;
      const [row] = await db
        .update(lessonTrackAActions)
        .set({
          ...patch,
          approvalLevel,
          updatedAt: new Date(),
        })
        .where(and(eq(lessonTrackAActions.id, id), eq(lessonTrackAActions.projectId, input.projectId)))
        .returning();

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      return row;
    }),

  setEvidence: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        actionId: z.string().uuid(),
        evidenceType: z.string().min(2).max(100),
        evidenceRef: z.string().min(2).max(2000),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);

      const [evidence] = await db
        .insert(lessonActionEvidence)
        .values({
          projectId: input.projectId,
          actionId: input.actionId,
          evidenceType: input.evidenceType,
          evidenceRef: input.evidenceRef,
          notes: input.notes ?? null,
          addedBy: ctx.user.id,
        })
        .returning();

      return evidence;
    }),

  createTrackB: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        cycleId: z.string().uuid().optional(),
        lessonId: z.string().uuid(),
        clusterId: z.string().uuid().optional(),
        structuralIssue: z.string().min(5).max(5000),
        proposedCorporateAction: z.string().min(5).max(5000),
        departmentOwner: z.string().max(255).optional(),
        recommendedTargetPhase: z
          .enum([
            "maturation",
            "feed",
            "detailed_design",
            "procurement",
            "fabrication",
            "installation",
            "commissioning",
            "operations",
          ])
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);

      const [lesson, cluster] = await Promise.all([
        db.query.lessonsLearned.findFirst({
          where: and(eq(lessonsLearned.id, input.lessonId), eq(lessonsLearned.projectId, input.projectId)),
          columns: { id: true, workflowState: true },
        }),
        input.clusterId
          ? db.query.lessonClusters.findFirst({
              where: and(eq(lessonClusters.id, input.clusterId), eq(lessonClusters.projectId, input.projectId)),
              columns: { id: true, trackType: true },
            })
          : Promise.resolve(null),
      ]);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      if (!["classified", "actioned", "report_ready"].includes(lesson.workflowState)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Lesson must be classified before creating Track B escalations",
        });
      }
      if (input.clusterId && !cluster) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cluster not found" });
      }
      if (cluster?.trackType && cluster.trackType !== "B") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Track B escalations require a Track B cluster",
        });
      }

      const policy = await getPolicyProfile(input.projectId);
      const dueBy = new Date();
      dueBy.setDate(dueBy.getDate() + policy.reminderSlaDays);

      const [row] = await db
        .insert(lessonTrackBEscalations)
        .values({
          projectId: input.projectId,
          cycleId: input.cycleId ?? null,
          lessonId: input.lessonId,
          clusterId: input.clusterId ?? null,
          structuralIssue: input.structuralIssue,
          proposedCorporateAction: input.proposedCorporateAction,
          departmentOwner: input.departmentOwner ?? null,
          recommendedTargetPhase: input.recommendedTargetPhase ?? null,
          dueBy,
          createdBy: ctx.user.id,
        })
        .returning();

      await db
        .update(lessonsLearned)
        .set({ workflowState: "actioned", updatedAt: new Date() })
        .where(eq(lessonsLearned.id, input.lessonId));

      return row;
    }),

  submitTrackB: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), escalationId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["pmo_director", "hope"]);

      const escalation = await db.query.lessonTrackBEscalations.findFirst({
        where: and(
          eq(lessonTrackBEscalations.id, input.escalationId),
          eq(lessonTrackBEscalations.projectId, input.projectId)
        ),
        columns: { id: true, status: true },
      });
      if (!escalation) throw new TRPCError({ code: "NOT_FOUND" });
      if (escalation.status !== "draft") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only draft Track B escalations can be submitted",
        });
      }

      const [row] = await db
        .update(lessonTrackBEscalations)
        .set({
          status: "submitted",
          submittedBy: ctx.user.id,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(lessonTrackBEscalations.id, input.escalationId),
            eq(lessonTrackBEscalations.projectId, input.projectId)
          )
        )
        .returning();

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });

      await db.insert(notifications).values({
        userId: ctx.user.id,
        type: "lesson_track_b_submitted",
        referenceType: "lesson_track_b_escalation",
        referenceId: row.id,
        message: "Track B escalation submitted.",
      });

      return row;
    }),

  runQualityChecks: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return computeGateReadiness(input.projectId);
    }),

  startCycle: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        cycleType: cycleTypeSchema,
        cycleLabel: z.string().min(3).max(255),
        gateDate: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);
      const policy = await getPolicyProfile(input.projectId);
      const now = new Date();
      const activeCycle = await db.query.lessonCycles.findFirst({
        where: and(eq(lessonCycles.projectId, input.projectId), eq(lessonCycles.state, "active")),
        columns: { id: true },
      });
      if (activeCycle) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "An active cycle already exists for this project",
        });
      }

      const milestones = deriveCycleMilestones(input.gateDate ?? null);

      const [cycle] = await db
        .insert(lessonCycles)
        .values({
          projectId: input.projectId,
          policyProfileId: policy.id,
          cycleType: input.cycleType,
          cycleLabel: input.cycleLabel,
          state: "active",
          startsAt: now,
          gateDate: milestones.gateDate,
          tMinus6At: milestones.tMinus6At,
          tMinus5At: milestones.tMinus5At,
          tMinus4At: milestones.tMinus4At,
          tMinus3At: milestones.tMinus3At,
          tMinus2At: milestones.tMinus2At,
          tMinus1At: milestones.tMinus1At,
          createdBy: ctx.user.id,
        })
        .returning();

      return cycle;
    }),

  advanceCycle: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        cycleId: z.string().uuid(),
        state: cycleStateSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      await requireLessonRole(input.projectId, ctx.user.id, ["ll_manager", "pmo_director"]);

      if (input.state === "completed") {
        const readiness = await computeGateReadiness(input.projectId);
        if (!readiness.isGateReady) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Quality checks failed. Resolve blockers before completing cycle.",
          });
        }
      }

      const [row] = await db
        .update(lessonCycles)
        .set({
          state: input.state,
          completedAt: input.state === "completed" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(lessonCycles.id, input.cycleId), eq(lessonCycles.projectId, input.projectId)))
        .returning();

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return row;
    }),

  listClusters: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.lessonClusters.findMany({
        where: eq(lessonClusters.projectId, input.projectId),
        with: {
          clusterItems: {
            with: {
              lesson: { columns: { id: true, title: true, workflowState: true } },
            },
          },
          package: { columns: { id: true, code: true, name: true } },
        },
        orderBy: [desc(lessonClusters.createdAt)],
      });
    }),

  listTrackA: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);

      const today = new Date();
      const actions = await db.query.lessonTrackAActions.findMany({
        where: eq(lessonTrackAActions.projectId, input.projectId),
        with: {
          lesson: { columns: { id: true, title: true } },
          cluster: { columns: { id: true, clusterName: true, trackType: true } },
          evidence: { columns: { id: true } },
        },
        orderBy: [asc(lessonTrackAActions.dueAt), desc(lessonTrackAActions.createdAt)],
      });

      for (const action of actions) {
        if (action.status !== "done" && action.dueAt && action.dueAt < today) {
          await db
            .update(lessonTrackAActions)
            .set({ status: "overdue", updatedAt: new Date() })
            .where(eq(lessonTrackAActions.id, action.id));
          action.status = "overdue";
        }
      }

      return actions;
    }),

  listTrackB: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), status: escalationStatusSchema.optional() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.lessonTrackBEscalations.findMany({
        where: and(
          eq(lessonTrackBEscalations.projectId, input.projectId),
          input.status ? eq(lessonTrackBEscalations.status, input.status) : undefined
        ),
        with: {
          lesson: { columns: { id: true, title: true } },
          cluster: { columns: { id: true, clusterName: true } },
        },
        orderBy: [desc(lessonTrackBEscalations.createdAt)],
      });
    }),

  listCycles: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.lessonCycles.findMany({
        where: eq(lessonCycles.projectId, input.projectId),
        orderBy: [desc(lessonCycles.createdAt)],
      });
    }),

  getWorkflowOverview: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      const readiness = await computeGateReadiness(input.projectId);

      const openCycle = await db.query.lessonCycles.findFirst({
        where: and(eq(lessonCycles.projectId, input.projectId), eq(lessonCycles.state, "active")),
        orderBy: [desc(lessonCycles.createdAt)],
      });

      const overdueActions = await db
        .select({ count: count() })
        .from(lessonTrackAActions)
        .where(and(eq(lessonTrackAActions.projectId, input.projectId), eq(lessonTrackAActions.status, "overdue")));

      const pendingEscalations = await db
        .select({ count: count() })
        .from(lessonTrackBEscalations)
        .where(and(eq(lessonTrackBEscalations.projectId, input.projectId), inArray(lessonTrackBEscalations.status, ["draft", "submitted"])));

      return {
        ...readiness,
        activeCycle: openCycle,
        kpis: {
          overdueTrackAActions: overdueActions[0]?.count ?? 0,
          pendingTrackBSubmissions: pendingEscalations[0]?.count ?? 0,
        },
      };
    }),

  runReminderSweep: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "admin");

      const overdue = await db.query.lessonTrackAActions.findMany({
        where: and(eq(lessonTrackAActions.projectId, input.projectId), lt(lessonTrackAActions.dueAt, new Date())),
        columns: { id: true, ownerUserId: true, actionText: true },
      });

      const notificationsToCreate = overdue
        .filter((row) => row.ownerUserId)
        .map((row) => ({
          userId: row.ownerUserId!,
          type: "lesson_track_a_overdue",
          referenceType: "lesson_track_a_action",
          referenceId: row.id,
          message: `Track A action overdue: ${row.actionText.slice(0, 80)}`,
        }));

      if (notificationsToCreate.length > 0) {
        await db.insert(notifications).values(notificationsToCreate as any);
      }

      return { reminders: notificationsToCreate.length };
    }),
});
