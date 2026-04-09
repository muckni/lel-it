import { createTRPCRouter } from "@/trpc/init";
import { portfolioRouter } from "./portfolio";

export const appRouter = createTRPCRouter({
  portfolio: portfolioRouter,
});

export type AppRouter = typeof appRouter;
