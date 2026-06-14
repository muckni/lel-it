import { createTRPCRouter } from "@/trpc/init";
import { projectRouter } from "./project";
import { portfolioRouter } from "./portfolio";
import { notificationRouter } from "./notification";
import { activityRouter } from "./activity";
import { attachmentRouter } from "./attachment";
import { lessonV2Router } from "./lesson-v2";
import { inboxRouter } from "./inbox";

export const appRouter = createTRPCRouter({
  project: projectRouter,
  portfolio: portfolioRouter,
  notification: notificationRouter,
  activity: activityRouter,
  attachment: attachmentRouter,
  lessonV2: lessonV2Router,
  inbox: inboxRouter,
});

export type AppRouter = typeof appRouter;
