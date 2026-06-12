import { createTRPCRouter } from "@/trpc/init";
import { portfolioRouter } from "./portfolio";
import { workPackageRouter } from "./work-package";
import { registerRouter } from "./register";
import { agreementRouter } from "./agreement";
import { interfacePointRouter } from "./interface-point";
import { deliverableRouter } from "./deliverable";
import { interfaceQueryRouter } from "./interface-query";
import { commentRouter } from "./comment";
import { notificationRouter } from "./notification";
import { assetPlacementRouter } from "./asset-placement";
import { reportRouter } from "./report";
import { activityRouter } from "./activity";
import { projectRouter } from "./project";
import { attachmentRouter } from "./attachment";
import { deadlineRouter } from "./deadline";
import { interfaceCaseRouter } from "./interface-case";
import { interfaceMatrixRouter } from "./interface-matrix";
import { interfaceReportRouter } from "./interface-report";
import { interfaceTrackerRouter } from "./interface-tracker";
import { mocRouter } from "./moc";
import { modelRegistryRouter } from "./model-registry";
import { interfaceWorkspaceRouter } from "./interface-workspace";
import { cableRouteRouter } from "./cable-route";
import { anchorCatalogRouter } from "./anchor-catalog";
import { lessonLearnedRouter } from "./lesson-learned";
import { lessonOpsRouter } from "./lesson-ops";
import { lessonPolicyRouter } from "./lesson-policy";
import { lessonPortfolioRouter } from "./lesson-portfolio";
import { lessonReportRouter } from "./lesson-report";
import { lessonV2Router } from "./lesson-v2";

export const appRouter = createTRPCRouter({
  portfolio: portfolioRouter,
  workPackage: workPackageRouter,
  register: registerRouter,
  agreement: agreementRouter,
  interfacePoint: interfacePointRouter,
  deliverable: deliverableRouter,
  interfaceQuery: interfaceQueryRouter,
  comment: commentRouter,
  notification: notificationRouter,
  assetPlacement: assetPlacementRouter,
  report: reportRouter,
  activity: activityRouter,
  project: projectRouter,
  attachment: attachmentRouter,
  deadline: deadlineRouter,
  interfaceCase: interfaceCaseRouter,
  interfaceMatrix: interfaceMatrixRouter,
  interfaceReport: interfaceReportRouter,
  interfaceTracker: interfaceTrackerRouter,
  moc: mocRouter,
  modelRegistry: modelRegistryRouter,
  interfaceWorkspace: interfaceWorkspaceRouter,
  cableRoute: cableRouteRouter,
  anchorCatalog: anchorCatalogRouter,
  lessonLearned: lessonLearnedRouter,
  lessonOps: lessonOpsRouter,
  lessonPolicy: lessonPolicyRouter,
  lessonPortfolio: lessonPortfolioRouter,
  lessonReport: lessonReportRouter,
  lessonV2: lessonV2Router,
});

export type AppRouter = typeof appRouter;
