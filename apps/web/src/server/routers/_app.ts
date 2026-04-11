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
});

export type AppRouter = typeof appRouter;
