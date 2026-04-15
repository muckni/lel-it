# Lessons Learned Implementation Plan

## Implementation Note (2026-04-15)
- Added project-level module separation scaffolding with a module contract and top-corner switcher in the dashboard shell.
- Added lessons ownership-state model (`permissive/restricted/prohibited/unclear`) to `lessons_learned` and policy-based visibility filtering in lesson list/detail, portfolio cockpit aggregates, and report pack generation.
- Added Lessons module UI support for ownership-state badge display, ownership filtering in Capture view, and editor/admin ownership-state updates in lesson detail.
- Enforced ownership-state visibility in `lessonOps` read models and lesson comment read/write access to avoid restricted-content leakage.
- New migration: `packages/db/drizzle/0012_phase10_lessons_ownership_state.sql`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a continuous, execution-embedded Lessons Learned feature that any project member can capture in 3 clicks and that the PMO can consolidate into cross-project insights.

**Architecture:** LL is a first-class entity in the DB, linked optionally to interface points and work packages. Any editor can draft and validate; only admins can consolidate. Capture happens both from a dedicated `/lessons` page and inline on the interface point detail page. The dedicated page is the central PMO view with filtering.

**Tech Stack:** Drizzle ORM + PostgreSQL, tRPC v11 (`protectedProcedure`, `useTRPC()`), TanStack Query v5, Next.js 16, shadcn/ui, Zod v4, Vitest.

**IMPORTANT:** Read `apps/web/AGENTS.md` before writing any Next.js page or component code.

---

## Feature Definition

**What is a Lesson Learned?** A structured observation captured during project execution — not retrospectively. It records what happened, why it happened, and what should be done differently (or repeated).

**Types:** `problem` | `success` | `risk` | `improvement` | `process_deviation`

**Lifecycle:** `draft` → `validated` → `consolidated` → `closed`

- **draft**: Created by any editor. Content editable by author or any editor.
- **validated**: Marked by any editor — confirms the entry is accurate and worth keeping. Sets `validatedById` + `validatedAt`.
- **consolidated**: Admin-only. Entry has been rolled up into a cross-project insight or action. Sets `consolidatedById` + `consolidatedAt`.
- **closed**: Admin-only. Entry is archived (resolved, not actionable, or duplicate).

**Governance:**
- `create` / `update` / `delete (draft only)`: editor+
- `validate` (draft → validated): editor+
- `consolidate` / `close` (validated → consolidated/closed): admin

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/db/src/schema.ts` | Modify | Add 3 enums + `lessonsLearned` table + relations |
| `packages/db/drizzle/XXXX_lessons_learned.sql` | Auto-generated | Migration |
| `apps/web/src/server/lib/project-id.ts` | Modify | Add `projectIdForLessonLearned` |
| `apps/web/src/server/routers/lesson-learned.ts` | Create | tRPC router: list, getById, create, update, validate, consolidate, delete |
| `apps/web/src/server/routers/_app.ts` | Modify | Register `lessonLearned` router |
| `apps/web/src/server/__tests__/router-authz.test.ts` | Modify | Add LL to DB mock + 3 auth tests |
| `apps/web/src/app/(dashboard)/projects/[projectId]/layout.tsx` | Modify | Add "Lessons" tab |
| `apps/web/src/app/(dashboard)/projects/[projectId]/lessons/page.tsx` | Create | Full LL page: list + filters + create button |
| `apps/web/src/components/lessons/ll-badge.tsx` | Create | `LLStatusBadge` + `LLTypeBadge` components |
| `apps/web/src/components/lessons/create-ll-dialog.tsx` | Create | Quick-capture dialog (title + type + description) |
| `apps/web/src/components/lessons/ll-card.tsx` | Create | Card: summary + inline validate/consolidate actions |
| `apps/web/src/app/(dashboard)/projects/[projectId]/registers/[registerId]/agreements/[agreementId]/points/[pointId]/page.tsx` | Modify | Add LL section: linked capture + list |

---

## Task 1: DB schema — enums, `lessonsLearned` table, relations

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add three new pgEnums after the existing enums block (around line 100)**

Open `packages/db/src/schema.ts`. Add after the last existing `pgEnum` declaration:

```ts
export const llTypeEnum = pgEnum("ll_type", [
  "problem",
  "success",
  "risk",
  "improvement",
  "process_deviation",
]);

export const llStatusEnum = pgEnum("ll_status", [
  "draft",
  "validated",
  "consolidated",
  "closed",
]);

export const llDisciplineEnum = pgEnum("ll_discipline", [
  "engineering",
  "procurement",
  "construction",
  "installation",
  "commissioning",
  "project_management",
  "hse",
  "commercial",
  "other",
]);
```

- [ ] **Step 2: Add `lessonsLearned` table after the `cableRoutes` table (near end of schema)**

```ts
export const lessonsLearned = pgTable(
  "lessons_learned",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Core content
    title: text("title").notNull(),
    description: text("description").notNull(),
    recommendation: text("recommendation"),
    // Classification
    type: llTypeEnum("type").notNull().default("problem"),
    discipline: llDisciplineEnum("discipline").notNull().default("other"),
    projectPhase: projectPhaseEnum("project_phase"),
    // Status lifecycle
    status: llStatusEnum("status").notNull().default("draft"),
    // Authorship
    authorId: uuid("author_id").notNull(),
    validatedById: uuid("validated_by_id"),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    consolidatedById: uuid("consolidated_by_id"),
    consolidatedAt: timestamp("consolidated_at", { withTimezone: true }),
    // Optional links to existing entities
    interfacePointId: uuid("interface_point_id").references(
      () => interfacePoints.id,
      { onDelete: "set null" }
    ),
    workPackageId: uuid("work_package_id").references(
      () => workPackages.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("lessons_learned_project_id_idx").on(table.projectId),
    index("lessons_learned_interface_point_id_idx").on(table.interfacePointId),
    index("lessons_learned_status_idx").on(table.projectId, table.status),
  ]
);
```

- [ ] **Step 3: Add relations**

After the existing relations block, add:

```ts
export const lessonsLearnedRelations = relations(lessonsLearned, ({ one }) => ({
  project: one(projects, {
    fields: [lessonsLearned.projectId],
    references: [projects.id],
  }),
  interfacePoint: one(interfacePoints, {
    fields: [lessonsLearned.interfacePointId],
    references: [interfacePoints.id],
  }),
  workPackage: one(workPackages, {
    fields: [lessonsLearned.workPackageId],
    references: [workPackages.id],
  }),
}));
```

Also add `lessons: many(lessonsLearned)` to `projectsRelations`:

```ts
// In projectsRelations, add alongside existing many() entries:
lessons: many(lessonsLearned),
```

- [ ] **Step 4: Generate migration**

```bash
pnpm --filter @owit/db db:generate
```

Expected: creates `packages/db/drizzle/0010_*.sql` with `CREATE TYPE ll_type`, `CREATE TYPE ll_status`, `CREATE TYPE ll_discipline`, and `CREATE TABLE lessons_learned`.

- [ ] **Step 5: Verify build**

```bash
pnpm --filter @owit/web build
```

Expected: compiles successfully (types resolve).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(ll): add lessons_learned schema, enums, and relations"
```

---

## Task 2: tRPC router — full CRUD + lifecycle transitions

**Files:**
- Create: `apps/web/src/server/routers/lesson-learned.ts`
- Modify: `apps/web/src/server/lib/project-id.ts`
- Modify: `apps/web/src/server/routers/_app.ts`

- [ ] **Step 1: Add `projectIdForLessonLearned` to project-id.ts**

Open `apps/web/src/server/lib/project-id.ts`. Add at the end:

```ts
export async function projectIdForLessonLearned(id: string): Promise<string> {
  const row = await db.query.lessonsLearned.findFirst({
    where: eq(lessonsLearned.id, id),
    columns: { projectId: true },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  return row.projectId;
}
```

Add `lessonsLearned` to the import from `@owit/db` at the top of that file.

- [ ] **Step 2: Create `apps/web/src/server/routers/lesson-learned.ts`**

```ts
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { db, lessonsLearned } from "@owit/db";
import { and, eq, desc } from "drizzle-orm";
import { assertMember, requireRole } from "@/server/lib/rbac";
import { projectIdForLessonLearned } from "@/server/lib/project-id";
import { TRPCError } from "@trpc/server";

const LL_TYPES = ["problem", "success", "risk", "improvement", "process_deviation"] as const;
const LL_STATUSES = ["draft", "validated", "consolidated", "closed"] as const;
const LL_DISCIPLINES = [
  "engineering", "procurement", "construction", "installation",
  "commissioning", "project_management", "hse", "commercial", "other",
] as const;
const PROJECT_PHASES = [
  "maturation", "feed", "detailed_design", "procurement",
  "fabrication", "installation", "commissioning", "operations",
] as const;

export const lessonLearnedRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      status: z.enum(LL_STATUSES).optional(),
      type: z.enum(LL_TYPES).optional(),
      discipline: z.enum(LL_DISCIPLINES).optional(),
      interfacePointId: z.string().uuid().optional(),
      workPackageId: z.string().uuid().optional(),
    }))
    .query(async ({ input, ctx }) => {
      await assertMember(ctx.user.id, input.projectId);
      return db.query.lessonsLearned.findMany({
        where: and(
          eq(lessonsLearned.projectId, input.projectId),
          input.status ? eq(lessonsLearned.status, input.status) : undefined,
          input.type ? eq(lessonsLearned.type, input.type) : undefined,
          input.discipline ? eq(lessonsLearned.discipline, input.discipline) : undefined,
          input.interfacePointId ? eq(lessonsLearned.interfacePointId, input.interfacePointId) : undefined,
          input.workPackageId ? eq(lessonsLearned.workPackageId, input.workPackageId) : undefined,
        ),
        with: {
          interfacePoint: { columns: { id: true, code: true, title: true } },
          workPackage: { columns: { id: true, code: true, name: true, color: true } },
        },
        orderBy: [desc(lessonsLearned.createdAt)],
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await assertMember(ctx.user.id, projectId);
      return db.query.lessonsLearned.findFirst({
        where: eq(lessonsLearned.id, input.id),
        with: {
          interfacePoint: { columns: { id: true, code: true, title: true } },
          workPackage: { columns: { id: true, code: true, name: true, color: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().min(1).max(5000),
      recommendation: z.string().max(5000).optional(),
      type: z.enum(LL_TYPES).default("problem"),
      discipline: z.enum(LL_DISCIPLINES).default("other"),
      projectPhase: z.enum(PROJECT_PHASES).optional(),
      interfacePointId: z.string().uuid().optional(),
      workPackageId: z.string().uuid().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await requireRole(ctx.user.id, input.projectId, "editor");
      const [ll] = await db
        .insert(lessonsLearned)
        .values({ ...input, authorId: ctx.user.id })
        .returning();
      return ll;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().min(1).max(5000).optional(),
      recommendation: z.string().max(5000).optional(),
      type: z.enum(LL_TYPES).optional(),
      discipline: z.enum(LL_DISCIPLINES).optional(),
      projectPhase: z.enum(PROJECT_PHASES).optional(),
      interfacePointId: z.string().uuid().nullable().optional(),
      workPackageId: z.string().uuid().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      // Only editable while draft or validated
      const existing = await db.query.lessonsLearned.findFirst({
        where: eq(lessonsLearned.id, input.id),
        columns: { status: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status === "consolidated" || existing.status === "closed") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot edit a consolidated or closed lesson" });
      }
      const { id, ...values } = input;
      const [updated] = await db
        .update(lessonsLearned)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(lessonsLearned.id, id))
        .returning();
      return updated;
    }),

  validate: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      const [updated] = await db
        .update(lessonsLearned)
        .set({
          status: "validated",
          validatedById: ctx.user.id,
          validatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(lessonsLearned.id, input.id), eq(lessonsLearned.status, "draft")))
        .returning();
      if (!updated) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Lesson must be in draft status to validate" });
      return updated;
    }),

  consolidate: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(["consolidated", "closed"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await requireRole(ctx.user.id, projectId, "admin");
      const [updated] = await db
        .update(lessonsLearned)
        .set({
          status: input.status,
          consolidatedById: ctx.user.id,
          consolidatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(lessonsLearned.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const projectId = await projectIdForLessonLearned(input.id);
      await requireRole(ctx.user.id, projectId, "editor");
      const existing = await db.query.lessonsLearned.findFirst({
        where: eq(lessonsLearned.id, input.id),
        columns: { status: true, authorId: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (existing.status !== "draft") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only draft lessons can be deleted" });
      }
      await db.delete(lessonsLearned).where(eq(lessonsLearned.id, input.id));
      return { success: true };
    }),
});
```

- [ ] **Step 3: Register in `apps/web/src/server/routers/_app.ts`**

Add import:
```ts
import { lessonLearnedRouter } from "./lesson-learned";
```

Add to `appRouter`:
```ts
lessonLearned: lessonLearnedRouter,
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter @owit/web build
```

Expected: compiles. TypeScript resolves all types from schema.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/routers/lesson-learned.ts apps/web/src/server/routers/_app.ts apps/web/src/server/lib/project-id.ts
git commit -m "feat(ll): add lessonLearned tRPC router with full lifecycle"
```

---

## Task 3: Router authorization tests

**Files:**
- Modify: `apps/web/src/server/__tests__/router-authz.test.ts`

- [ ] **Step 1: Add `lessonsLearned` to the `@owit/db` mock**

In the `vi.mock("@owit/db", ...)` factory, add to `db.query`:
```ts
lessonsLearned: {
  findMany: vi.fn().mockResolvedValue([]),
  findFirst: vi.fn().mockResolvedValue({
    id: "00000000-0000-4000-8000-000000000004",
    projectId: "00000000-0000-4000-8000-000000000001",
    status: "draft",
    authorId: "00000000-0000-4000-8000-000000000007",
  }),
},
```

And add to the top-level mock exports:
```ts
lessonsLearned: {},
```

- [ ] **Step 2: Add LL const and auth test describe block**

Add at the end of the file, before the final closing:

```ts
const LL = "00000000-0000-4000-8000-000000000008";

describe("lessonLearned mutations require editor+", () => {
  beforeEach(() => {
    mockRequireRole.mockReset();
    mockAssertMember.mockResolvedValue(undefined);
  });

  it("lessonLearned.create is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { lessonLearnedRouter } = await import("../routers/lesson-learned");
    const caller = lessonLearnedRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.create({
        projectId: PROJ,
        title: "Test LL",
        description: "Something went wrong",
        type: "problem",
        discipline: "engineering",
      })
    );
  });

  it("lessonLearned.validate is blocked for viewer", async () => {
    mockRequireRole.mockRejectedValue(FORBIDDEN);
    const { lessonLearnedRouter } = await import("../routers/lesson-learned");
    const caller = lessonLearnedRouter.createCaller(viewerCtx as any);
    await viewerForbids(() => caller.validate({ id: LL }));
  });

  it("lessonLearned.consolidate is blocked for editor (requires admin)", async () => {
    mockRequireRole.mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN", message: "Requires admin role" })
    );
    const { lessonLearnedRouter } = await import("../routers/lesson-learned");
    const caller = lessonLearnedRouter.createCaller(viewerCtx as any);
    await viewerForbids(() =>
      caller.consolidate({ id: LL, status: "consolidated" })
    );
  });
});
```

- [ ] **Step 3: Run tests — verify they pass**

```bash
pnpm --filter @owit/web test -- --run
```

Expected: all 35 tests pass (32 existing + 3 new).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/__tests__/router-authz.test.ts
git commit -m "test(ll): add router authorization tests for lessonLearned"
```

---

## Task 4: Navigation tab + page skeleton

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/layout.tsx`
- Create: `apps/web/src/app/(dashboard)/projects/[projectId]/lessons/page.tsx`

- [ ] **Step 1: Add "Lessons" tab to layout**

Open `apps/web/src/app/(dashboard)/projects/[projectId]/layout.tsx`.

In the `baseTabs` array, add after `{ name: "Queries", href: "/queries" }`:

```ts
{ name: "Lessons", href: "/lessons" },
```

- [ ] **Step 2: Create page skeleton**

Create `apps/web/src/app/(dashboard)/projects/[projectId]/lessons/page.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { BookOpenIcon } from "lucide-react";

export default function LessonsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lessons Learned</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture and consolidate execution insights
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpenIcon className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-medium">No lessons yet for project {projectId}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build and navigation renders**

```bash
pnpm --filter @owit/web build
```

Expected: new route `/projects/[projectId]/lessons` is static-generated, "Lessons" tab visible in nav.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/projects/\[projectId\]/layout.tsx apps/web/src/app/\(dashboard\)/projects/\[projectId\]/lessons/page.tsx
git commit -m "feat(ll): add Lessons nav tab and page skeleton"
```

---

## Task 5: `LLStatusBadge` + `LLTypeBadge` components

**Files:**
- Create: `apps/web/src/components/lessons/ll-badge.tsx`

- [ ] **Step 1: Create `apps/web/src/components/lessons/ll-badge.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type LLStatus = "draft" | "validated" | "consolidated" | "closed";
type LLType = "problem" | "success" | "risk" | "improvement" | "process_deviation";

const STATUS_CONFIG: Record<LLStatus, { label: string; className: string }> = {
  draft:       { label: "Draft",       className: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  validated:   { label: "Validated",   className: "bg-blue-100 text-blue-700 border-blue-200" },
  consolidated:{ label: "Consolidated",className: "bg-green-100 text-green-700 border-green-200" },
  closed:      { label: "Closed",      className: "bg-gray-100 text-gray-500 border-gray-200" },
};

const TYPE_CONFIG: Record<LLType, { label: string; className: string }> = {
  problem:           { label: "Problem",            className: "bg-red-100 text-red-700 border-red-200" },
  success:           { label: "Success",            className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  risk:              { label: "Risk",               className: "bg-orange-100 text-orange-700 border-orange-200" },
  improvement:       { label: "Improvement",        className: "bg-sky-100 text-sky-700 border-sky-200" },
  process_deviation: { label: "Process Deviation",  className: "bg-purple-100 text-purple-700 border-purple-200" },
};

export function LLStatusBadge({ status }: { status: LLStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

export function LLTypeBadge({ type }: { type: LLType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @owit/web build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/lessons/ll-badge.tsx
git commit -m "feat(ll): add LLStatusBadge and LLTypeBadge components"
```

---

## Task 6: `CreateLLDialog` — quick capture

**Files:**
- Create: `apps/web/src/components/lessons/create-ll-dialog.tsx`

- [ ] **Step 1: Create `apps/web/src/components/lessons/create-ll-dialog.tsx`**

This is the 3-click capture form. Required fields: title, type, description. All others optional. When `interfacePointId` is passed as prop, it auto-links the LL.

```tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";

const schema = z.object({
  title: z.string().min(1, "Title required").max(500),
  type: z.enum(["problem", "success", "risk", "improvement", "process_deviation"]),
  discipline: z.enum([
    "engineering", "procurement", "construction", "installation",
    "commissioning", "project_management", "hse", "commercial", "other",
  ]),
  description: z.string().min(1, "Description required").max(5000),
  recommendation: z.string().max(5000).optional(),
});

type FormValues = z.infer<typeof schema>;

const TYPE_OPTIONS: { value: FormValues["type"]; label: string }[] = [
  { value: "problem",           label: "Problem" },
  { value: "success",           label: "Success" },
  { value: "risk",              label: "Risk" },
  { value: "improvement",       label: "Improvement" },
  { value: "process_deviation", label: "Process Deviation" },
];

const DISCIPLINE_OPTIONS: { value: FormValues["discipline"]; label: string }[] = [
  { value: "engineering",       label: "Engineering" },
  { value: "procurement",       label: "Procurement" },
  { value: "construction",      label: "Construction" },
  { value: "installation",      label: "Installation" },
  { value: "commissioning",     label: "Commissioning" },
  { value: "project_management",label: "Project Management" },
  { value: "hse",               label: "HSE" },
  { value: "commercial",        label: "Commercial" },
  { value: "other",             label: "Other" },
];

interface Props {
  projectId: string;
  interfacePointId?: string;
  workPackageId?: string;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export function CreateLLDialog({ projectId, interfacePointId, workPackageId, onSuccess, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "problem", discipline: "engineering", title: "", description: "" },
  });

  const create = useMutation(
    trpc.lessonLearned.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.lessonLearned.list.queryOptions({ projectId }));
        if (interfacePointId) {
          queryClient.invalidateQueries(
            trpc.lessonLearned.list.queryOptions({ projectId, interfacePointId })
          );
        }
        form.reset();
        setOpen(false);
        onSuccess?.();
      },
    })
  );

  function onSubmit(values: FormValues) {
    create.mutate({ ...values, projectId, interfacePointId, workPackageId });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <PlusIcon className="mr-1 h-4 w-4" />
            Capture Lesson
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Capture Lesson Learned</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="One-line summary of the lesson" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discipline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discipline</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DISCIPLINE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What happened?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the situation, context, and impact"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recommendation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recommendation <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What should be done differently next time?"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Saving…" : "Capture"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @owit/web build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/lessons/create-ll-dialog.tsx
git commit -m "feat(ll): add CreateLLDialog quick-capture component"
```

---

## Task 7: `LLCard` — display with inline actions

**Files:**
- Create: `apps/web/src/components/lessons/ll-card.tsx`

- [ ] **Step 1: Create `apps/web/src/components/lessons/ll-card.tsx`**

```tsx
"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LLStatusBadge, LLTypeBadge } from "./ll-badge";
import { CheckIcon, ArchiveIcon, Trash2Icon, LinkIcon } from "lucide-react";

type LL = {
  id: string;
  title: string;
  description: string;
  recommendation?: string | null;
  type: "problem" | "success" | "risk" | "improvement" | "process_deviation";
  discipline: string;
  status: "draft" | "validated" | "consolidated" | "closed";
  authorId: string;
  createdAt: string | Date;
  interfacePoint?: { id: string; code: string; title: string } | null;
  workPackage?: { id: string; code: string; name: string; color: string } | null;
};

interface Props {
  ll: LL;
  projectId: string;
  canEdit: boolean;
  canAdmin: boolean;
}

export function LLCard({ ll, projectId, canEdit, canAdmin }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  function invalidate() {
    queryClient.invalidateQueries(trpc.lessonLearned.list.queryOptions({ projectId }));
  }

  const validate = useMutation(
    trpc.lessonLearned.validate.mutationOptions({ onSuccess: invalidate })
  );

  const consolidate = useMutation(
    trpc.lessonLearned.consolidate.mutationOptions({ onSuccess: invalidate })
  );

  const remove = useMutation(
    trpc.lessonLearned.delete.mutationOptions({ onSuccess: invalidate })
  );

  return (
    <Card className="relative">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <LLTypeBadge type={ll.type} />
              <LLStatusBadge status={ll.status} />
              <span className="text-xs text-muted-foreground capitalize">{ll.discipline.replace("_", " ")}</span>
            </div>
            <p className="font-medium text-sm leading-snug">{ll.title}</p>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{ll.description}</p>
            {ll.recommendation && (
              <p className="mt-1 text-xs text-muted-foreground border-l-2 border-muted pl-2 italic line-clamp-1">
                → {ll.recommendation}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {ll.interfacePoint && (
                <span className="flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  {ll.interfacePoint.code}
                </span>
              )}
              {ll.workPackage && (
                <span className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: ll.workPackage.color }}
                  />
                  {ll.workPackage.code}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            {canEdit && ll.status === "draft" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => validate.mutate({ id: ll.id })}
                disabled={validate.isPending}
              >
                <CheckIcon className="mr-1 h-3 w-3" />
                Validate
              </Button>
            )}
            {canAdmin && ll.status === "validated" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => consolidate.mutate({ id: ll.id, status: "consolidated" })}
                disabled={consolidate.isPending}
              >
                <ArchiveIcon className="mr-1 h-3 w-3" />
                Consolidate
              </Button>
            )}
            {canEdit && ll.status === "draft" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => remove.mutate({ id: ll.id })}
                disabled={remove.isPending}
              >
                <Trash2Icon className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @owit/web build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/lessons/ll-card.tsx
git commit -m "feat(ll): add LLCard with inline validate/consolidate/delete actions"
```

---

## Task 8: Full lessons page — list, filters, stats

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/lessons/page.tsx`

- [ ] **Step 1: Replace page skeleton with full implementation**

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useProjectRole } from "@/hooks/use-project-role";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BookOpenIcon } from "lucide-react";
import { CreateLLDialog } from "@/components/lessons/create-ll-dialog";
import { LLCard } from "@/components/lessons/ll-card";

type LLStatus = "draft" | "validated" | "consolidated" | "closed";
type LLType   = "problem" | "success" | "risk" | "improvement" | "process_deviation";
type LLDisc   = "engineering" | "procurement" | "construction" | "installation" |
                "commissioning" | "project_management" | "hse" | "commercial" | "other";

const STATUS_OPTIONS: { value: LLStatus | "all"; label: string }[] = [
  { value: "all",         label: "All statuses" },
  { value: "draft",       label: "Draft" },
  { value: "validated",   label: "Validated" },
  { value: "consolidated",label: "Consolidated" },
  { value: "closed",      label: "Closed" },
];

const TYPE_OPTIONS: { value: LLType | "all"; label: string }[] = [
  { value: "all",              label: "All types" },
  { value: "problem",          label: "Problem" },
  { value: "success",          label: "Success" },
  { value: "risk",             label: "Risk" },
  { value: "improvement",      label: "Improvement" },
  { value: "process_deviation",label: "Process Deviation" },
];

const DISCIPLINE_OPTIONS: { value: LLDisc | "all"; label: string }[] = [
  { value: "all",               label: "All disciplines" },
  { value: "engineering",       label: "Engineering" },
  { value: "procurement",       label: "Procurement" },
  { value: "construction",      label: "Construction" },
  { value: "installation",      label: "Installation" },
  { value: "commissioning",     label: "Commissioning" },
  { value: "project_management",label: "Project Mgmt" },
  { value: "hse",               label: "HSE" },
  { value: "commercial",        label: "Commercial" },
  { value: "other",             label: "Other" },
];

export default function LessonsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const { canEdit, isAdmin } = useProjectRole(projectId);

  const [statusFilter, setStatusFilter]     = useState<LLStatus | "all">("all");
  const [typeFilter, setTypeFilter]         = useState<LLType   | "all">("all");
  const [disciplineFilter, setDisciplineFilter] = useState<LLDisc | "all">("all");

  const { data: lessons = [], isLoading } = useQuery(
    trpc.lessonLearned.list.queryOptions({
      projectId,
      status:     statusFilter !== "all" ? statusFilter : undefined,
      type:       typeFilter   !== "all" ? typeFilter   : undefined,
      discipline: disciplineFilter !== "all" ? disciplineFilter : undefined,
    })
  );

  // Summary counts (always from unfiltered — reuse list query without filters for counts)
  const { data: allLessons = [] } = useQuery(
    trpc.lessonLearned.list.queryOptions({ projectId })
  );

  const counts = {
    draft:        allLessons.filter((l) => l.status === "draft").length,
    validated:    allLessons.filter((l) => l.status === "validated").length,
    consolidated: allLessons.filter((l) => l.status === "consolidated").length,
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lessons Learned</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {allLessons.length} lesson{allLessons.length !== 1 ? "s" : ""} captured
          </p>
        </div>
        {canEdit && <CreateLLDialog projectId={projectId} />}
      </div>

      {/* Summary cards */}
      {allLessons.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Draft",        count: counts.draft,        color: "text-zinc-600" },
            { label: "Validated",    count: counts.validated,    color: "text-blue-600" },
            { label: "Consolidated", count: counts.consolidated, color: "text-green-600" },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LLStatus | "all")}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as LLType | "all")}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={disciplineFilter} onValueChange={(v) => setDisciplineFilter(v as LLDisc | "all")}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISCIPLINE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || typeFilter !== "all" || disciplineFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setStatusFilter("all"); setTypeFilter("all"); setDisciplineFilter("all"); }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpenIcon className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-sm font-medium">
            {allLessons.length === 0 ? "No lessons captured yet" : "No lessons match the current filters"}
          </p>
          {canEdit && allLessons.length === 0 && (
            <div className="mt-4">
              <CreateLLDialog projectId={projectId} />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map((ll) => (
            <LLCard
              key={ll.id}
              ll={ll as any}
              projectId={projectId}
              canEdit={canEdit}
              canAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @owit/web build
pnpm --filter @owit/web test -- --run
```

Expected: build clean, 35/35 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/projects/\[projectId\]/lessons/page.tsx
git commit -m "feat(ll): implement full lessons page with filters and summary cards"
```

---

## Task 9: Embed LL capture on interface point detail page

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/registers/[registerId]/agreements/[agreementId]/points/[pointId]/page.tsx`

- [ ] **Step 1: Read the current page**

Open the file. It already has sections for deliverables, queries, and comments. Find the last section tab or the bottom of the main content area to add the LL section.

- [ ] **Step 2: Add LL imports at the top**

```tsx
import { CreateLLDialog } from "@/components/lessons/create-ll-dialog";
import { LLCard } from "@/components/lessons/ll-card";
import { LLStatusBadge, LLTypeBadge } from "@/components/lessons/ll-badge";
```

- [ ] **Step 3: Add LL query alongside existing queries**

Near where `deliverables`, `queries` are queried, add:

```tsx
const { data: linkedLessons = [] } = useQuery(
  trpc.lessonLearned.list.queryOptions({
    projectId,
    interfacePointId: pointId,
  })
);
```

`pointId` is already extracted from `useParams()` in this page.

- [ ] **Step 4: Add LL section to the page JSX**

After the existing Queries or Comments section, add:

```tsx
{/* Lessons Learned */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
      Lessons Learned
      {linkedLessons.length > 0 && (
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal normal-case">
          {linkedLessons.length}
        </span>
      )}
    </h3>
    {canEdit && (
      <CreateLLDialog
        projectId={projectId}
        interfacePointId={pointId}
        trigger={
          <Button size="sm" variant="outline" className="h-7 text-xs">
            + Capture
          </Button>
        }
      />
    )}
  </div>
  {linkedLessons.length === 0 ? (
    <p className="text-xs text-muted-foreground">No lessons linked to this interface point.</p>
  ) : (
    linkedLessons.map((ll) => (
      <LLCard
        key={ll.id}
        ll={ll as any}
        projectId={projectId}
        canEdit={canEdit}
        canAdmin={isAdmin}
      />
    ))
  )}
</div>
```

- [ ] **Step 5: Check `canEdit` and `isAdmin` are available in this page**

The page already uses `useProjectRole(projectId)` — confirm `canEdit` and `isAdmin` are destructured. If only `canEdit` is destructured currently, add `isAdmin`:

```tsx
const { canEdit, isAdmin } = useProjectRole(projectId);
```

- [ ] **Step 6: Verify build and tests**

```bash
pnpm --filter @owit/web build
pnpm --filter @owit/web test -- --run
```

Expected: build clean, 35/35 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/projects/\[projectId\]/registers/\[registerId\]/agreements/\[agreementId\]/points/\[pointId\]/page.tsx
git commit -m "feat(ll): embed Lessons Learned capture and list on interface point detail page"
```

---

## Task 10: Final integration check + migration commit

**Files:**
- Check: `packages/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Verify migration snapshot is committed**

```bash
cd /path/to/repo
git status packages/db/drizzle/
```

If `meta/0010_snapshot.json` exists but is untracked, commit it:

```bash
git add packages/db/drizzle/
git commit -m "chore(db): commit drizzle migration snapshot for lessons_learned"
```

- [ ] **Step 2: Run full build + tests one final time**

```bash
pnpm --filter @owit/web build
pnpm --filter @owit/web test -- --run
```

Expected: build clean. 35/35 tests pass.

- [ ] **Step 3: Verify navigation smoke test**

Start dev server (`pnpm dev`), open a project, confirm "Lessons" tab is visible in the project nav. Click it — page loads. Click "Capture Lesson" — dialog opens with Title, Type, Discipline, Description fields.

---

## MVP vs Phase 2

### MVP (this plan — 10 tasks)
- `lessons_learned` table with full lifecycle
- `list`, `create`, `update`, `validate`, `consolidate`, `delete` tRPC procedures
- Dedicated `/lessons` page with status/type/discipline filters and summary cards
- Quick-capture dialog (3 required fields)
- Inline embed on interface point detail page
- Role-based governance: editor creates/validates, admin consolidates

### Phase 2
- **Cross-project aggregation**: portfolio-level `/lessons` page querying across all user projects
- **Recurring issue detection**: group LLs by type+discipline, flag when same discipline has >3 problems
- **Export**: `exportLessons` tRPC query → Excel via existing `@/lib/excel` SheetJS wrapper
- **AI tag suggestion**: call Claude via Anthropic SDK on description text → suggest discipline + root cause
- **Meeting transcript extraction**: paste transcript → extract candidate LLs as drafts for human review
- **LL linking on deliverables**: add `deliverableId` optional FK to `lessonsLearned` + embed on deliverable page
- **Root cause field**: `llRootCauseEnum` (`communication`, `process`, `technical`, `resource`, `external`) — add to schema in Phase 2 to avoid enum migration churn

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|---|---|
| Continuous, lightweight capture | CreateLLDialog (3 required fields), +Capture button on IP page |
| Lifecycle: draft → validated → consolidated → closed | llStatusEnum, `validate` + `consolidate` procedures |
| Types: problem/success/risk/improvement/process_deviation | llTypeEnum |
| Linked to interface points | `interfacePointId` FK, embedded on point page |
| Linked to work packages | `workPackageId` FK, passed as prop to CreateLLDialog |
| Governance: editor creates/validates, admin consolidates | `requireRole` checks in all mutations |
| PMO filters + summary cards | LessonsPage with 3 filter selects + 3 count cards |
| No heavy admin burden | Single `validate` click, single `consolidate` click, no multi-step approvals |
| Integrates with existing workflows | Embedded on IP detail page, shares existing tRPC/RBAC/component patterns |
| Scales across projects | `projectId` FK on all queries, no cross-project shared state |
| Cross-project insights | Phase 2 (scoped out intentionally to stay MVP) |
| AI extraction | Phase 2 |
