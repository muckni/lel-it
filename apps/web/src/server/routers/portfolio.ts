import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, portfolios, projects } from "@owit/db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const portfolioRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.query.portfolios.findMany({
      where: eq(portfolios.ownerId, ctx.user.id),
      with: { projects: true },
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const [portfolio] = await db
        .insert(portfolios)
        .values({ name: input.name, ownerId: ctx.user.id })
        .returning();
      return portfolio;
    }),

  createProject: protectedProcedure
    .input(
      z.object({
        portfolioId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // P0-2: verify portfolio belongs to calling user
      const portfolio = await db.query.portfolios.findFirst({
        where: eq(portfolios.id, input.portfolioId),
        columns: { ownerId: true },
      });
      if (!portfolio || portfolio.ownerId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [project] = await db
        .insert(projects)
        .values({
          portfolioId: input.portfolioId,
          name: input.name,
          description: input.description,
        })
        .returning();
      return project;
    }),
});
