import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  lessonCycles,
  lessonTrackAActions,
  lessonTrackBEscalations,
  lessonsLearned,
  portfolios,
  projects,
} from "@owit/db";
import { getVisibleLessonOwnershipStates } from "@/server/lib/lesson-visibility";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

async function portfolioIdForUser(userId: string) {
  const row = await db.query.portfolios.findFirst({
    where: eq(portfolios.ownerId, userId),
    columns: { id: true },
  });
  return row?.id ?? null;
}

export const lessonPortfolioRouter = createTRPCRouter({
  getCockpit: protectedProcedure.query(async ({ ctx }) => {
    const portfolioId = await portfolioIdForUser(ctx.user.id);
    if (!portfolioId) {
      return {
        kpis: {
          activeProjects: 0,
          openCycles: 0,
          overdueTrackAActions: 0,
          pendingTrackBSubmissions: 0,
          gateReadyProjects: 0,
        },
        projects: [],
      };
    }

    const portfolioProjects = await db.query.projects.findMany({
      where: and(eq(projects.portfolioId, portfolioId), eq(projects.status, "active")),
      columns: { id: true, name: true },
      orderBy: [projects.name],
    });

    const projectIds = portfolioProjects.map((project) => project.id);
    if (projectIds.length === 0) {
      return {
        kpis: {
          activeProjects: 0,
          openCycles: 0,
          overdueTrackAActions: 0,
          pendingTrackBSubmissions: 0,
          gateReadyProjects: 0,
        },
        projects: [],
      };
    }

    const [openCycles, overdueTrackAActions, pendingTrackBSubmissions] = await Promise.all([
      db
        .select({ count: count() })
        .from(lessonCycles)
        .where(and(inArray(lessonCycles.projectId, projectIds), eq(lessonCycles.state, "active"))),
      db
        .select({ count: count() })
        .from(lessonTrackAActions)
        .where(and(inArray(lessonTrackAActions.projectId, projectIds), eq(lessonTrackAActions.status, "overdue"))),
      db
        .select({ count: count() })
        .from(lessonTrackBEscalations)
        .where(
          and(
            inArray(lessonTrackBEscalations.projectId, projectIds),
            inArray(lessonTrackBEscalations.status, ["draft", "submitted"])
          )
        ),
    ]);

    const visibilityByProject = new Map<string, Awaited<ReturnType<typeof getVisibleLessonOwnershipStates>>>();
    await Promise.all(
      portfolioProjects.map(async (project) => {
        visibilityByProject.set(
          project.id,
          await getVisibleLessonOwnershipStates(project.id, ctx.user.id)
        );
      })
    );

    const projectRows = await Promise.all(
      portfolioProjects.map(async (project) => {
        const visibleOwnershipStates =
          visibilityByProject.get(project.id) ?? ["permissive"];
        const [activeCycle, overdueActions, pendingEscalations, untriaged] = await Promise.all([
          db.query.lessonCycles.findFirst({
            where: and(eq(lessonCycles.projectId, project.id), eq(lessonCycles.state, "active")),
            columns: { id: true, cycleType: true, state: true, cycleLabel: true, gateDate: true },
            orderBy: [desc(lessonCycles.createdAt)],
          }),
          db
            .select({ count: count() })
            .from(lessonTrackAActions)
            .where(and(eq(lessonTrackAActions.projectId, project.id), eq(lessonTrackAActions.status, "overdue"))),
          db
            .select({ count: count() })
            .from(lessonTrackBEscalations)
            .where(
              and(
                eq(lessonTrackBEscalations.projectId, project.id),
                inArray(lessonTrackBEscalations.status, ["draft", "submitted"])
              )
            ),
          db
            .select({ count: count() })
            .from(lessonsLearned)
            .where(
              and(
                eq(lessonsLearned.projectId, project.id),
                eq(lessonsLearned.workflowState, "ingested"),
                inArray(lessonsLearned.ownershipState, visibleOwnershipStates)
              )
            ),
        ]);

        const gateReady =
          (overdueActions[0]?.count ?? 0) === 0 &&
          (pendingEscalations[0]?.count ?? 0) === 0 &&
          (untriaged[0]?.count ?? 0) === 0;

        return {
          projectId: project.id,
          projectName: project.name,
          cycle: activeCycle,
          overdueTrackAActions: overdueActions[0]?.count ?? 0,
          pendingTrackBSubmissions: pendingEscalations[0]?.count ?? 0,
          unresolvedUnknowns: untriaged[0]?.count ?? 0,
          gateReady,
        };
      })
    );

    const gateReadyProjects = projectRows.filter((row) => row.gateReady).length;

    return {
      kpis: {
        activeProjects: portfolioProjects.length,
        openCycles: openCycles[0]?.count ?? 0,
        overdueTrackAActions: overdueTrackAActions[0]?.count ?? 0,
        pendingTrackBSubmissions: pendingTrackBSubmissions[0]?.count ?? 0,
        gateReadyProjects,
      },
      projects: projectRows,
    };
  }),

  listAtRiskProjects: protectedProcedure.query(async ({ ctx }) => {
    const portfolioId = await portfolioIdForUser(ctx.user.id);
    if (!portfolioId) return [];

    const projectsInPortfolio = await db.query.projects.findMany({
      where: and(eq(projects.portfolioId, portfolioId), eq(projects.status, "active")),
      columns: { id: true, name: true },
    });
    const projectIds = projectsInPortfolio.map((project) => project.id);
    if (projectIds.length === 0) return [];

    const visibilityByProject = new Map<string, Awaited<ReturnType<typeof getVisibleLessonOwnershipStates>>>();
    await Promise.all(
      projectsInPortfolio.map(async (project) => {
        visibilityByProject.set(
          project.id,
          await getVisibleLessonOwnershipStates(project.id, ctx.user.id)
        );
      })
    );

    const rows = await Promise.all(
      projectsInPortfolio.map(async (project) => {
        const visibleOwnershipStates =
          visibilityByProject.get(project.id) ?? ["permissive"];
        const [overdueActions, pendingEscalations, unresolvedUnknowns] = await Promise.all([
          db
            .select({ count: count() })
            .from(lessonTrackAActions)
            .where(and(eq(lessonTrackAActions.projectId, project.id), eq(lessonTrackAActions.status, "overdue"))),
          db
            .select({ count: count() })
            .from(lessonTrackBEscalations)
            .where(
              and(
                eq(lessonTrackBEscalations.projectId, project.id),
                inArray(lessonTrackBEscalations.status, ["draft", "submitted"])
              )
            ),
          db
            .select({ count: count() })
            .from(lessonsLearned)
            .where(
              and(
                eq(lessonsLearned.projectId, project.id),
                eq(lessonsLearned.workflowState, "ingested"),
                inArray(lessonsLearned.ownershipState, visibleOwnershipStates)
              )
            ),
        ]);

        const overdueTrackAActions = overdueActions[0]?.count ?? 0;
        const pendingTrackBSubmissions = pendingEscalations[0]?.count ?? 0;
        const unresolved = unresolvedUnknowns[0]?.count ?? 0;
        const gateReady =
          overdueTrackAActions === 0 && pendingTrackBSubmissions === 0 && unresolved === 0;

        return {
          projectId: project.id,
          projectName: project.name,
          overdueTrackAActions,
          pendingTrackBSubmissions,
          unresolvedUnknowns: unresolved,
          gateReady,
        };
      })
    );

    return rows.filter(
      (project) =>
        !project.gateReady ||
        project.overdueTrackAActions > 0 ||
        project.pendingTrackBSubmissions > 0
    );
  }),

  listOverdueActions: protectedProcedure.query(async ({ ctx }) => {
    const portfolioId = await portfolioIdForUser(ctx.user.id);
    if (!portfolioId) return [];

    return db.query.lessonTrackAActions.findMany({
      where: eq(lessonTrackAActions.status, "overdue"),
      with: {
        project: {
          columns: { id: true, name: true, portfolioId: true },
        },
        lesson: {
          columns: { id: true, title: true, ownershipState: true },
        },
      },
      orderBy: [desc(lessonTrackAActions.updatedAt)],
    }).then(async (rows) => {
      const visibleStatesByProject = new Map<string, Awaited<ReturnType<typeof getVisibleLessonOwnershipStates>>>();
      const projectIds = Array.from(new Set(rows.map((row) => row.project.id)));
      await Promise.all(
        projectIds.map(async (projectId) => {
          visibleStatesByProject.set(
            projectId,
            await getVisibleLessonOwnershipStates(projectId, ctx.user.id)
          );
        })
      );

      return rows.filter((row) => {
        if (row.project.portfolioId !== portfolioId) return false;
        const visibleStates = visibleStatesByProject.get(row.project.id) ?? ["permissive"];
        return row.lesson ? visibleStates.includes(row.lesson.ownershipState) : true;
      });
    });
  }),

  listPendingEscalations: protectedProcedure.query(async ({ ctx }) => {
    const portfolioId = await portfolioIdForUser(ctx.user.id);
    if (!portfolioId) return [];

    return db.query.lessonTrackBEscalations.findMany({
      where: inArray(lessonTrackBEscalations.status, ["draft", "submitted"]),
      with: {
        project: {
          columns: { id: true, name: true, portfolioId: true },
        },
        lesson: {
          columns: { id: true, title: true, ownershipState: true },
        },
      },
      orderBy: [desc(lessonTrackBEscalations.updatedAt)],
    }).then(async (rows) => {
      const visibleStatesByProject = new Map<string, Awaited<ReturnType<typeof getVisibleLessonOwnershipStates>>>();
      const projectIds = Array.from(new Set(rows.map((row) => row.project.id)));
      await Promise.all(
        projectIds.map(async (projectId) => {
          visibleStatesByProject.set(
            projectId,
            await getVisibleLessonOwnershipStates(projectId, ctx.user.id)
          );
        })
      );

      return rows.filter((row) => {
        if (row.project.portfolioId !== portfolioId) return false;
        const visibleStates = visibleStatesByProject.get(row.project.id) ?? ["permissive"];
        return row.lesson ? visibleStates.includes(row.lesson.ownershipState) : true;
      });
    });
  }),
});
