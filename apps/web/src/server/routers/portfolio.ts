import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, portfolios, projectMembers, projects } from "@owit/db";
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
        // phase is optional here; the DB column has notNull + default("maturation")
        // so omitting it lets the DB default apply rather than forcing a value
        phase: z.enum([
          "maturation", "feed", "detailed_design", "procurement",
          "fabrication", "installation", "commissioning", "operations",
        ]).optional(),
        setup: z.object({
          foundationType: z.enum([
            "monopile_with_tp",
            "monopile_without_tp",
            "jacket",
            "other",
          ]),
          hasOssInterface: z.boolean(),
        }),
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

      return db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({
            portfolioId: input.portfolioId,
            name: input.name,
            description: input.description,
            phase: input.phase,
            metadata: {
              setup: input.setup,
            },
          })
          .returning();

        // Ensure project creator has immediate admin permissions.
        await tx
          .insert(projectMembers)
          .values({
            projectId: project.id,
            userId: ctx.user.id,
            role: "admin",
          })
          .onConflictDoNothing();

        return project;
      });
    }),
});
