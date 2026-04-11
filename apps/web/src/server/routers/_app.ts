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
});

export type AppRouter = typeof appRouter;
