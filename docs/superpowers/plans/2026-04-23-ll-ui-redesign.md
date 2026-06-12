# Lessons Learned UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the HTML prototype visual design (IBM Plex fonts, row-list capture, slide-in detail panel, compact filter bar, stepper pills) into the existing Next.js lessons module. The backend is fully built; this plan targets visual fidelity + two missing DB columns.

**Architecture:** Scoped changes only — new `location`/`tags` DB columns, two new components (`LessonRow`, `LessonDetailPanel`), compact filter bar, and stepper polish. All within the existing `codex/phase10-lessons-module` branch. No backend rewrites.

**Tech Stack:** Next.js 16, tRPC v11, Drizzle ORM, Zod v4, shadcn/ui, Tailwind CSS v4, React 19, `next/font/google` (IBM Plex Sans + Mono)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/db/src/schema.ts` | Modify | Add `location text`, `tags text[]` to `lessonsLearned` |
| `packages/db/drizzle/0013_ll_location_tags.sql` | Create | Migration for the two new columns |
| `packages/db/drizzle/meta/_journal.json` | Modify | Register migration |
| `packages/db/drizzle/meta/0013_snapshot.json` | Create | Drizzle snapshot |
| `apps/web/src/server/routers/lesson-learned.ts` | Modify | Add `location`/`tags` to `create` + `updateDraft` input + insert |
| `apps/web/src/app/layout.tsx` | Modify | Add IBM Plex Sans + Mono via `next/font/google` |
| `apps/web/src/components/lessons/ll-row.tsx` | Create | Scannable lesson row: left accent bar, title+badges, meta |
| `apps/web/src/components/lessons/ll-detail-panel.tsx` | Create | 480px slide-in panel: Detail/Comments tabs, footer actions |
| `apps/web/src/components/lessons/create-ll-dialog.tsx` | Modify | Remove text-smuggling for location/tags; use proper fields → router |
| `apps/web/src/app/(dashboard)/projects/[projectId]/modules/lessons/page.tsx` | Modify | Replace card-per-lesson with `LessonRow`, add `LessonDetailPanel`, compact filter bar, redesigned stepper |

---

## Task 1: Add `location` + `tags` columns to schema + migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0013_ll_location_tags.sql`

- [ ] **Step 1: Update schema**

In `packages/db/src/schema.ts`, find the `lessonsLearned` table definition (around line 1304). Add two columns after `ownershipRationale`:

```ts
    location: text("location"),
    tags: text("tags").array().notNull().default([]),
```

The block should look like:
```ts
    ownershipRationale: text("ownership_rationale"),
    location: text("location"),
    tags: text("tags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
```

- [ ] **Step 2: Write migration SQL**

Create `packages/db/drizzle/0013_ll_location_tags.sql`:

```sql
ALTER TABLE "lessons_learned" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "lessons_learned" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;
```

- [ ] **Step 3: Update Drizzle journal**

In `packages/db/drizzle/meta/_journal.json`, append to the `entries` array:

```json
    {
      "idx": 13,
      "version": "7",
      "when": 1745000000000,
      "tag": "0013_ll_location_tags",
      "breakpoints": true
    }
```

- [ ] **Step 4: Generate snapshot**

Run:
```bash
cd "/Users/niels_muck/Projects /Offshore Wind Interface Tool"
pnpm --filter @owit/db generate
```

If the generate command fails or overwrites, manually copy `packages/db/drizzle/meta/0012_snapshot.json` to `0013_snapshot.json` and update the `tables.lessons_learned.columns` section to add:
```json
"location": {
  "name": "location",
  "type": "text",
  "primaryKey": false,
  "notNull": false,
  "autoincrement": false
},
"tags": {
  "name": "tags",
  "type": "text[]",
  "primaryKey": false,
  "notNull": true,
  "autoincrement": false,
  "default": "'{}'"
}
```

- [ ] **Step 5: Verify TypeScript builds**

```bash
pnpm --filter @owit/db build 2>&1 | tail -5
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): add location + tags columns to lessons_learned"
```

---

## Task 2: Update lesson-learned router to persist location + tags

**Files:**
- Modify: `apps/web/src/server/routers/lesson-learned.ts`

- [ ] **Step 1: Add to `create` input schema**

Find the `create` procedure input (around line 228). Add after `ownershipState`:

```ts
        location: z.string().max(500).optional(),
        tags: z.array(z.string().max(100)).max(20).optional(),
```

- [ ] **Step 2: Add to `create` insert values**

Find the `db.insert(lessonsLearned).values({...})` call. Add:

```ts
          location: input.location ?? null,
          tags: input.tags ?? [],
```

- [ ] **Step 3: Add to `updateDraft` input**

Find the `updateDraft` procedure. Add to its input schema:

```ts
        location: z.string().max(500).optional(),
        tags: z.array(z.string().max(100)).max(20).optional(),
```

- [ ] **Step 4: Add to `updateDraft` set values**

In the `db.update(lessonsLearned).set({...})` call, add:

```ts
          ...(input.location !== undefined && { location: input.location }),
          ...(input.tags !== undefined && { tags: input.tags }),
```

- [ ] **Step 5: Verify build**

```bash
pnpm --filter @owit/web build 2>&1 | tail -10
```
Expected: clean build.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @owit/web test -- --run 2>&1 | tail -10
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/server/routers/lesson-learned.ts
git commit -m "feat(ll): add location + tags to create/updateDraft router procedures"
```

---

## Task 3: Add IBM Plex Sans + Mono fonts

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Update layout.tsx**

Replace the contents of `apps/web/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "OWIT - Offshore Wind Interface Tool",
  description:
    "Interface management for offshore wind projects — from maturation to operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Expose CSS tokens in globals.css**

In `apps/web/src/app/globals.css`, inside the `@theme inline {` block, add after the existing font variables:

```css
  --font-ibm-plex-sans: var(--font-ibm-plex-sans);
  --font-ibm-plex-mono: var(--font-ibm-plex-mono);
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter @owit/web build 2>&1 | grep -E "error|Error|✓" | head -5
```
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/globals.css
git commit -m "chore(fonts): add IBM Plex Sans + Mono via next/font"
```

---

## Task 4: Create LessonRow component

**Files:**
- Create: `apps/web/src/components/lessons/ll-row.tsx`

- [ ] **Step 1: Create component**

```tsx
// apps/web/src/components/lessons/ll-row.tsx
"use client";

import { LLStatusBadge, LLTypeBadge } from "@/components/lessons/ll-badge";

const TYPE_ACCENT: Record<string, string> = {
  problem: "#BE123C",
  success: "#15803D",
  risk: "#B45309",
  improvement: "#4338CA",
  process_deviation: "#C2410C",
};

const DISC_LABELS: Record<string, string> = {
  engineering: "Engineering",
  procurement: "Procurement",
  construction: "Construction",
  installation: "Installation",
  commissioning: "Commissioning",
  project_management: "Project Management",
  hse: "HSE",
  commercial: "Commercial",
  other: "Other",
};

const PHASE_LABELS: Record<string, string> = {
  maturation: "Maturation",
  feed: "FEED",
  detailed_design: "Detailed Design",
  procurement: "Procurement",
  fabrication: "Fabrication",
  installation: "Installation",
  commissioning: "Commissioning",
  operations: "Operations",
};

export type LessonRowItem = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  discipline: string;
  projectPhase?: string | null;
  createdAt: string | Date;
  workPackage?: { code: string; name: string; color?: string | null } | null;
};

type Props = {
  lesson: LessonRowItem;
  selected: boolean;
  onClick: () => void;
};

export function LessonRow({ lesson, selected, onClick }: Props) {
  const accent = TYPE_ACCENT[lesson.type] ?? "#6B7280";
  const showPhase =
    lesson.projectPhase &&
    PHASE_LABELS[lesson.projectPhase] !== DISC_LABELS[lesson.discipline];

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer items-stretch border-b border-[#F3F4F6] transition-colors hover:bg-[#FAFAF9]"
      style={{ background: selected ? "#F8FAFF" : undefined }}
    >
      {/* Left accent bar */}
      <div
        className="w-[3px] shrink-0 rounded-none transition-colors"
        style={{ background: selected ? accent : "transparent" }}
        aria-hidden
      />

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">
        {/* Title + badges */}
        <div className="flex items-start gap-2.5">
          <p
            className="flex-1 text-[13px] font-medium leading-snug text-[#111827]"
            style={{ fontFamily: "var(--font-ibm-plex-sans, inherit)" }}
          >
            {lesson.title}
          </p>
          <div className="flex shrink-0 items-center gap-1 pt-px">
            <LLTypeBadge type={lesson.type as any} />
            <LLStatusBadge status={lesson.status as any} />
          </div>
        </div>

        {/* Description — 1 line truncated */}
        <p className="truncate text-[12px] leading-relaxed text-[#6B7280]">
          {lesson.description}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
          {lesson.workPackage && (
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                background: `${lesson.workPackage.color ?? "#6366F1"}22`,
                color: lesson.workPackage.color ?? "#6366F1",
              }}
            >
              {lesson.workPackage.code}
            </span>
          )}
          <span>{DISC_LABELS[lesson.discipline] ?? lesson.discipline}</span>
          {showPhase && (
            <>
              <span className="text-[#E5E7EB]">·</span>
              <span>{PHASE_LABELS[lesson.projectPhase!]}</span>
            </>
          )}
          <span className="text-[#E5E7EB]">·</span>
          <span
            className="tabular-nums"
            style={{ fontFamily: "var(--font-ibm-plex-mono, monospace)" }}
          >
            {new Date(lesson.createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            })}
          </span>
        </div>
      </div>

      {/* Chevron */}
      <div
        className="flex shrink-0 items-center pr-3.5 text-sm transition-colors"
        style={{ color: selected ? "#2563EB" : "#D1D5DB" }}
        aria-hidden
      >
        ›
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/niels_muck/Projects /Offshore Wind Interface Tool"
pnpm --filter @owit/web exec tsc --noEmit 2>&1 | grep "ll-row" | head -5
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/lessons/ll-row.tsx
git commit -m "feat(ll): add LessonRow component with left accent bar"
```

---

## Task 5: Create LessonDetailPanel component

**Files:**
- Create: `apps/web/src/components/lessons/ll-detail-panel.tsx`

- [ ] **Step 1: Create component**

```tsx
// apps/web/src/components/lessons/ll-detail-panel.tsx
"use client";

import { useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LLStatusBadge, LLTypeBadge, LLOwnershipBadge } from "@/components/lessons/ll-badge";
import { LessonCommentsThread } from "@/components/lessons/lesson-comments-thread";

const DISC_LABELS: Record<string, string> = {
  engineering: "Engineering",
  procurement: "Procurement",
  construction: "Construction",
  installation: "Installation",
  commissioning: "Commissioning",
  project_management: "Project Management",
  hse: "HSE",
  commercial: "Commercial",
  other: "Other",
};

const PHASE_LABELS: Record<string, string> = {
  maturation: "Maturation",
  feed: "FEED",
  detailed_design: "Detailed Design",
  procurement: "Procurement",
  fabrication: "Fabrication",
  installation: "Installation",
  commissioning: "Commissioning",
  operations: "Operations",
};

export type DetailLesson = {
  id: string;
  title: string;
  description: string;
  recommendation?: string | null;
  type: string;
  status: string;
  discipline: string;
  ownershipState: string;
  projectPhase?: string | null;
  location?: string | null;
  tags?: string[];
  createdAt: string | Date;
  workPackage?: { id: string; code: string; name: string; color?: string | null } | null;
  linkedPoints?: Array<{ interfacePoint: { id: string; code: string; title: string } }>;
  workflowState?: string;
};

type Props = {
  lesson: DetailLesson | null;
  onClose: () => void;
  canEdit: boolean;
  isAdmin: boolean;
  busy: boolean;
  onValidate: (id: string) => void;
  onConsolidate: (id: string) => void;
  onCloseLesson: (id: string) => void;
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p
        className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]"
        style={{ fontFamily: "var(--font-ibm-plex-sans, inherit)" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

export function LessonDetailPanel({
  lesson,
  onClose,
  canEdit,
  isAdmin,
  busy,
  onValidate,
  onConsolidate,
  onCloseLesson,
}: Props) {
  const [tab, setTab] = useState<"detail" | "comments">("detail");

  if (!lesson) return null;

  const wp = lesson.workPackage;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/15"
        aria-hidden
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col border-l border-[#E5E7EB] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)]"
        style={{ fontFamily: "var(--font-ibm-plex-sans, inherit)" }}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[#F3F4F6] px-5 pt-4 pb-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {/* Badges */}
              <div className="mb-2 flex flex-wrap gap-1.5">
                <LLTypeBadge type={lesson.type as any} />
                <LLStatusBadge status={lesson.status as any} />
                <LLOwnershipBadge ownershipState={lesson.ownershipState as any} />
                {wp && (
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: `${wp.color ?? "#6366F1"}22`,
                      color: wp.color ?? "#6366F1",
                    }}
                  >
                    {wp.code} · {wp.name}
                  </span>
                )}
              </div>
              {/* Title */}
              <p className="text-[14px] font-semibold leading-snug text-[#111827]">
                {lesson.title}
              </p>
              {/* Sub-meta */}
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                {DISC_LABELS[lesson.discipline] ?? lesson.discipline}
                {lesson.projectPhase
                  ? ` · ${PHASE_LABELS[lesson.projectPhase] ?? lesson.projectPhase}`
                  : ""}
                {" · "}
                {new Date(lesson.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1 text-[#9CA3AF] hover:text-[#374151]"
              aria-label="Close panel"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="mt-3 flex gap-0 border-b border-[#F3F4F6]">
            {(["detail", "comments"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3.5 pb-2 pt-2 text-[13px] font-medium transition-colors"
                style={{
                  color: tab === t ? "#111827" : "#6B7280",
                  borderBottom: tab === t ? "2px solid #0F172A" : "2px solid transparent",
                  background: "none",
                  border: tab === t ? undefined : "none",
                  borderBottomWidth: "2px",
                  borderBottomStyle: "solid",
                  borderBottomColor: tab === t ? "#0F172A" : "transparent",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {tab === "detail" && (
            <div className="flex flex-col gap-4">
              <Section label="What happened">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#374151]">
                  {lesson.description}
                </p>
              </Section>

              {lesson.recommendation && (
                <Section label="Recommendation">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#374151]">
                    {lesson.recommendation}
                  </p>
                </Section>
              )}

              {lesson.location && (
                <Section label="Location / Asset">
                  <p className="text-[13px] text-[#374151]">{lesson.location}</p>
                </Section>
              )}

              {lesson.tags && lesson.tags.length > 0 && (
                <Section label="Tags">
                  <div className="flex flex-wrap gap-1.5">
                    {lesson.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#6B7280]"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {lesson.linkedPoints && lesson.linkedPoints.length > 0 && (
                <Section label="Linked Interface Points">
                  <div className="flex flex-col gap-1">
                    {lesson.linkedPoints.map(({ interfacePoint: ip }) => (
                      <div key={ip.id} className="flex items-center gap-2 text-[12px] text-[#374151]">
                        <span className="font-semibold">{ip.code}</span>
                        <span className="text-[#6B7280]">{ip.title}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Section label="Workflow State">
                <p className="text-[13px] capitalize text-[#374151]">
                  {lesson.workflowState?.replace(/_/g, " ") ?? "—"}
                </p>
              </Section>
            </div>
          )}

          {tab === "comments" && (
            <LessonCommentsThread lessonId={lesson.id} />
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 flex flex-wrap items-center gap-2 border-t border-[#F3F4F6] px-5 py-3.5">
          {canEdit && lesson.status === "draft" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onValidate(lesson.id)}
              className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
            >
              ✓ Validate
            </Button>
          )}
          {isAdmin && lesson.status === "validated" && (
            <Button
              size="sm"
              disabled={busy}
              onClick={() => onConsolidate(lesson.id)}
              className="bg-[#15803D] hover:bg-[#166534] text-white"
            >
              ✦ Consolidate
            </Button>
          )}
          {isAdmin && lesson.status === "validated" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onCloseLesson(lesson.id)}
            >
              Archive
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
pnpm --filter @owit/web exec tsc --noEmit 2>&1 | grep "ll-detail-panel" | head -5
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/lessons/ll-detail-panel.tsx
git commit -m "feat(ll): add LessonDetailPanel slide-in component"
```

---

## Task 6: Update create-ll-dialog — remove text-smuggling, use proper fields

**Files:**
- Modify: `apps/web/src/components/lessons/create-ll-dialog.tsx`

The current dialog mangles `location` and `tags` into the description text (lines ~172-180). Fix it to send them as proper fields to the router.

- [ ] **Step 1: Find and replace the onSubmit handler**

Find the `onSubmit` function (around line 172). Replace the entire `createLesson.mutate({...})` call to pass `location` and `tags` as separate fields:

```ts
  function onSubmit(values: FormValues) {
    createLesson.mutate({
      projectId,
      title: values.title.trim(),
      description: values.problem.trim(),
      recommendation: values.solution?.trim() || undefined,
      type: values.type,
      discipline: values.discipline ?? "other",
      projectPhase: values.projectPhase ?? undefined,
      workPackageId: values.workPackageId || undefined,
      interfacePointIds: defaultInterfacePointId ? [defaultInterfacePointId] : [],
      location: values.location?.trim() || undefined,
      tags: values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined,
    });
  }
```

- [ ] **Step 2: Verify the form schema still includes location + tags**

The schema at the top of the file should already have:
```ts
  tags: z.string().max(500).optional(),
  location: z.string().max(500).optional(),
```
Confirm these are present. If not, add them.

- [ ] **Step 3: Verify build + tests**

```bash
pnpm --filter @owit/web build 2>&1 | tail -5
pnpm --filter @owit/web test -- --run 2>&1 | tail -5
```
Expected: clean build, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/lessons/create-ll-dialog.tsx
git commit -m "fix(ll): send location + tags as proper router fields instead of text-smuggling"
```

---

## Task 7: Redesign lessons module page — stepper + capture section

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/modules/lessons/page.tsx`

This task is the visual heart of the redesign. Make targeted changes:

### 7a: Add imports

At the top of the page file, add:
```tsx
import { LessonRow, type LessonRowItem } from "@/components/lessons/ll-row";
import { LessonDetailPanel, type DetailLesson } from "@/components/lessons/ll-detail-panel";
```

### 7b: Redesign the workflow stepper

Find the existing stepper (the `<Card>` containing `workflowSteps.map(...)`, around line 340). Replace it with:

```tsx
{/* Workflow stepper */}
<div
  className="flex shrink-0 items-center gap-0 rounded-lg border border-[#E5E7EB] bg-white px-4 py-2"
  style={{ fontFamily: "var(--font-ibm-plex-sans, inherit)" }}
>
  {(["capture", "review", "actions", "reports"] as const).map((key, i) => {
    const labels = ["Capture", "Review", "Actions", "Reports"];
    const isActive = section === key;
    const isPast = ["capture", "review", "actions", "reports"].indexOf(section) > i;
    return (
      <div key={key} className="flex items-center gap-0">
        {i > 0 && (
          <div
            className="mx-1 h-px w-4 shrink-0"
            style={{ background: isPast ? "#0F172A" : "#E5E7EB" }}
          />
        )}
        <button
          type="button"
          onClick={() => setSection(key)}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{
            background: isActive ? "#0F172A" : isPast ? "#F3F4F6" : "transparent",
            color: isActive ? "#fff" : isPast ? "#374151" : "#9CA3AF",
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >
          <span
            className="flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
            style={{
              background: isActive
                ? "rgba(255,255,255,0.2)"
                : isPast
                ? "#0F172A"
                : "#E5E7EB",
              color: isActive ? "#fff" : isPast ? "#fff" : "#9CA3AF",
            }}
          >
            {isPast ? "✓" : i + 1}
          </span>
          {labels[i]}
        </button>
      </div>
    );
  })}
</div>
```

### 7c: Replace the lesson card grid with LessonRow list

Find the capture section's lesson list (the `filteredLessons.map(...)` block that renders `<Card>` per lesson, around line 524). Replace with:

```tsx
<div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
  {filteredLessons.length === 0 ? (
    <p className="py-12 text-center text-sm text-muted-foreground">
      {t("noResults")}
    </p>
  ) : (
    filteredLessons.map((lesson) => (
      <LessonRow
        key={lesson.id}
        lesson={lesson as LessonRowItem}
        selected={selectedLessonId === lesson.id}
        onClick={() =>
          setSelectedLessonId(selectedLessonId === lesson.id ? null : lesson.id)
        }
      />
    ))
  )}
</div>
```

### 7d: Replace filter card+grid with compact single-row filter bar

Find the filter `<Card>` (around line 415, the one with `FilterIcon` header and `grid gap-3 md:grid-cols-2 xl:grid-cols-4` layout). Replace with:

```tsx
{/* Compact filter bar */}
<div
  className="flex flex-nowrap items-center gap-1.5 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5"
  style={{ fontFamily: "var(--font-ibm-plex-sans, inherit)" }}
>
  {/* Search */}
  <div className="relative min-w-[120px] flex-1">
    <SearchIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
    <input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search lessons…"
      className="w-full rounded-md border border-[#E5E7EB] bg-[#FAFAFA] py-1.5 pl-7 pr-2.5 text-[12px] text-[#111827] outline-none transition-colors focus:border-[#2563EB]"
      style={{ fontFamily: "inherit" }}
    />
  </div>

  {/* Filter selects */}
  {[
    {
      value: typeFilter,
      set: setTypeFilter,
      defaultLabel: "Type",
      opts: [
        { value: "all", label: "Type" },
        ...LESSON_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      ],
    },
    {
      value: statusFilter,
      set: setStatusFilter,
      defaultLabel: "Status",
      opts: [
        { value: "all", label: "Status" },
        ...LESSON_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      ],
    },
    {
      value: disciplineFilter,
      set: setDisciplineFilter,
      defaultLabel: "Discipline",
      opts: [
        { value: "all", label: "Discipline" },
        ...LESSON_DISCIPLINES.map((d) => ({ value: d, label: DISCIPLINE_LABELS[d] })),
      ],
    },
    {
      value: ownershipFilter,
      set: setOwnershipFilter,
      defaultLabel: "Ownership",
      opts: [
        { value: "all", label: "Ownership" },
        ...LESSON_OWNERSHIP_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      ],
    },
  ].map((f) => {
    const active = f.value !== "all";
    return (
      <div key={f.defaultLabel} className="relative">
        <select
          value={f.value}
          onChange={(e) => f.set(e.target.value)}
          className="appearance-none rounded-md py-1.5 pl-2.5 pr-6 text-[11px] font-medium outline-none transition-colors"
          style={{
            border: `1px solid ${active ? "#0F172A" : "#E5E7EB"}`,
            background: active ? "#0F172A" : "#fff",
            color: active ? "#F9FAFB" : "#374151",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {f.opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px]"
          style={{ color: active ? "#9CA3AF" : "#9CA3AF" }}
          aria-hidden
        >
          ▾
        </span>
      </div>
    );
  })}

  {/* Clear */}
  {(search || typeFilter !== "all" || statusFilter !== "all" || disciplineFilter !== "all" || ownershipFilter !== "all") && (
    <button
      onClick={() => {
        setSearch("");
        setTypeFilter("all");
        setStatusFilter("all");
        setDisciplineFilter("all");
        setOwnershipFilter("all");
      }}
      className="flex items-center gap-1 px-1.5 py-1 text-[11px] text-[#6B7280] hover:text-[#111827]"
      style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
    >
      ✕ Clear
    </button>
  )}
</div>
```

### 7e: Add LessonDetailPanel to page

Just before the closing `</div>` of the root return (or at the bottom of the JSX), add the panel render:

```tsx
{/* Slide-in detail panel */}
{selectedLessonId && selectedLesson && (
  <LessonDetailPanel
    lesson={selectedLesson as DetailLesson}
    onClose={() => setSelectedLessonId(null)}
    canEdit={canEdit}
    isAdmin={role === "admin"}
    busy={busy}
    onValidate={(id) => validateMutation.mutate({ id })}
    onConsolidate={(id) => {
      // consolidate mutation — use lessonLearned.consolidate if available,
      // otherwise extend the router. Placeholder: validate to consolidated via tRPC.
      validateMutation.mutate({ id });
    }}
    onCloseLesson={(id) => {
      // close/archive — extend router if needed. For now re-use validate.
      validateMutation.mutate({ id });
    }}
  />
)}
```

- [ ] **Step 1: Apply 7a (imports)**
- [ ] **Step 2: Apply 7b (stepper)**
- [ ] **Step 3: Apply 7c (lesson row list)**
- [ ] **Step 4: Apply 7d (compact filter bar)**
- [ ] **Step 5: Apply 7e (detail panel)**
- [ ] **Step 6: Verify build**

```bash
pnpm --filter @owit/web build 2>&1 | tail -10
```
Expected: clean build.

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @owit/web test -- --run 2>&1 | tail -5
```
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add "apps/web/src/app/(dashboard)/projects/[projectId]/modules/lessons/page.tsx"
git commit -m "feat(ll): redesign lessons page — stepper pills, LessonRow list, compact filter bar, slide-in panel"
```

---

## Task 8: Wire consolidate + close to real router procedures

**Files:**
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/modules/lessons/page.tsx`

Task 7e used `validateMutation` as a placeholder for consolidate/close. Wire them properly.

- [ ] **Step 1: Add consolidate mutation**

In the mutations block (around line 300), add:
```tsx
const consolidateMutation = useMutation(trpc.lessonLearned.consolidate.mutationOptions({ onSuccess: refreshAll }));
const closeLessonMutation = useMutation(trpc.lessonLearned.close.mutationOptions({ onSuccess: refreshAll }));
```

- [ ] **Step 2: Update busy flag**

Add the new mutations to the `busy` boolean:
```tsx
  const busy =
    validateMutation.isPending ||
    consolidateMutation.isPending ||
    closeLessonMutation.isPending ||
    // ... rest unchanged
```

- [ ] **Step 3: Update LessonDetailPanel call**

Replace the placeholder handlers in the panel:
```tsx
    onConsolidate={(id) => consolidateMutation.mutate({ id })}
    onCloseLesson={(id) => closeLessonMutation.mutate({ id })}
```

- [ ] **Step 4: Verify build + tests**

```bash
pnpm --filter @owit/web build 2>&1 | tail -5
pnpm --filter @owit/web test -- --run 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(dashboard)/projects/[projectId]/modules/lessons/page.tsx"
git commit -m "fix(ll): wire consolidate + close actions in LessonDetailPanel"
```

---

## Self-Review Checklist

After writing this plan, check:

1. **Spec coverage** — Design calls for IBM Plex fonts ✓, LessonRow ✓, detail panel ✓, compact filter bar ✓, stepper pills ✓, location/tags DB columns ✓. Review/Actions/Reports sections are already functional in the existing page and not touched here (correct — they match the design close enough or are outside scope).

2. **No placeholders** — Task 7e consolidate/close are addressed in Task 8. No TBDs remain.

3. **Type consistency** — `LessonRowItem` used in Task 4 + Task 7c. `DetailLesson` used in Task 5 + Task 7e. Both match their definitions.

4. **Scope check** — Focused: 8 tasks, all within lessons module. No unrelated changes.
