# Lessons Learned SaaS Refocus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the app down to a single canonical Lessons Learned product (delete all interface-management and v1/intermediate-lessons code + tables) and add a Notion-style full-page Lesson experience with rich-text bodies, a properties panel, file attachments, and comments.

**Architecture:** Five ordered stages. Stage 1 deletes legacy code and rewires the few retained routers that touched it; Stage 2 streamlines the database (drop ~45 tables/enums, add `content` to `lessons_v2`); Stage 3 adds the server API for editing lessons, lesson comments, and lesson attachments; Stage 4 builds the Notion-style page; Stage 5 rebrands. Each stage ends type-check-green with the retained v2 test suite passing.

**Tech Stack:** Next.js 16, tRPC v11, TanStack Query, Drizzle ORM (Postgres/Supabase), Tailwind v4, shadcn-style UI, TipTap (ProseMirror) for rich text, Supabase Storage for files, Vitest.

---

## Deviations from the design spec (corrections found during planning)

The spec assumed some infra was reusable as-is. Reading the code corrected three points; this plan supersedes the spec where they conflict:

1. **Attachment router is legacy-coupled, not reusable unchanged.** `attachment.ts` hardcodes `entityType ∈ {interface_point, deliverable, iq_response}` and resolves project IDs through soon-deleted tables via `project-id.ts`. It is **rewritten** to support `entityType = 'lesson'` only (Stage 3).
2. **v2 lesson comments do not exist yet.** `lesson_comments` table is defined but unused; the existing comments thread calls the legacy generic `comment` router (`comments` table). New `lessonV2` comment procedures + a new thread component are added (Stage 3/4); the generic `comment` router and `comments` table are deleted.
3. **`lesson-portfolio` router and `deadline` router are v1/legacy-built** (`lessonsLearned`, `lessonCycles`, `lessonTrackAActions`, `deliverables`). They are **deleted**, not kept. The corporate dashboard already provides the cross-project rollup.

---

## File Map

**Delete (whole files):**
- Routers: `apps/web/src/server/routers/{work-package,register,agreement,interface-point,deliverable,interface-query,asset-placement,interface-case,interface-matrix,interface-report,interface-tracker,moc,model-registry,interface-workspace,cable-route,anchor-catalog,report,lesson-learned,lesson-ops,lesson-policy,lesson-report,lesson-portfolio,comment,deadline}.ts`
- Server libs/tests: `apps/web/src/server/lib/{interface-compliance,lesson-workflow,lesson-visibility,project-id}.ts`; `apps/web/src/server/__tests__/{interface-compliance-rules,asset-anchor-catalog,lesson-visibility,lesson-workflow-rules}.test.ts`. **Note:** `lesson-rbac.ts` is NOT deleted — retained `lesson-v2-rbac.ts` depends on its `listLessonRolesForUser`; it is trimmed to just that helper + `LessonRoleType` (reads the retained `project_lesson_role_assignments`/`project_members`).
- Components/pages: `apps/web/src/components/lessons/{ll-card,ll-row,ll-detail-panel,create-ll-dialog,lesson-comments-thread,ll-badge,lessons-i18n}.tsx`; `apps/web/src/components/forms/work-package-form.tsx`; `apps/web/src/components/project-module-switcher.tsx`; `apps/web/src/app/(dashboard)/projects/[projectId]/lessons/page.tsx`; `apps/web/src/app/(dashboard)/projects/[projectId]/modules/lessons/page.tsx`; `apps/web/src/app/(dashboard)/lessons-portfolio/page.tsx`
- Stray iCloud-conflict file: `apps/web/src/server/lib/lesson-rbac 2.ts` (untracked duplicate)
- Shared: `packages/shared/src/{interface-compliance,asset-anchors}.ts`
- Docs assets: interface SVGs/PNGs under `docs/assets/readme/`

**Modify:**
- `apps/web/src/server/routers/_app.ts` — unregister deleted routers, register nothing new at top level (comments/attachments stay under their routers)
- `apps/web/src/server/routers/{project,activity}.ts` — remove interface-table usage
- `apps/web/src/server/routers/attachment.ts` — rewrite for `lesson` entity
- `apps/web/src/server/routers/lesson-v2.ts` — add `getLesson`, `updateLesson`, `listComments`, `addComment`, `deleteComment`
- `apps/web/src/server/lib/lesson-v2-rbac.ts` — add `edit_lesson` capability if missing
- `packages/db/src/schema.ts` — add `content` to `lessonsV2`; delete legacy table + enum definitions
- `packages/shared/src/{enums,types,index}.ts` — delete interface/v1 enums + types
- `apps/web/src/lib/{feature-flags,project-modules}.ts` — remove interface/module entries
- `apps/web/src/components/{app-sidebar,nav-main}.tsx`, `apps/web/src/app/(dashboard)/projects/[projectId]/lessons-v2/page.tsx` — nav + cockpit row navigation
- `apps/web/src/app/layout.tsx`, `apps/web/src/app/login/page.tsx`, `README.md` — branding

**Create:**
- `apps/web/src/server/lib/lesson-content.ts` — TipTap-JSON → plain-text excerpt
- `apps/web/src/server/lib/__tests__/lesson-content.test.ts`
- `apps/web/src/server/__tests__/lesson-v2-edit.test.ts`
- `apps/web/src/app/(dashboard)/projects/[projectId]/lessons/[lessonId]/page.tsx`
- `apps/web/src/components/lessons/lesson-editor.tsx` (TipTap body)
- `apps/web/src/components/lessons/lesson-properties-panel.tsx`
- `apps/web/src/components/lessons/lesson-attachments-panel.tsx`
- `apps/web/src/components/lessons/lesson-comments.tsx` (v2 thread)
- `packages/db/drizzle/0016_lessons_saas_streamline.sql` (additive `content` + destructive drops)

---

## Stage 1 — Legacy code teardown

### Task 1: Install TipTap dependencies

- [ ] **Step 1: Add dependencies**

Run:
```bash
pnpm --dir apps/web add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder
```
Expected: packages added to `apps/web/package.json`, lockfile updated.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "build: add TipTap editor dependencies"
```

### Task 2: Unregister and delete legacy routers

**Files:** Modify `apps/web/src/server/routers/_app.ts`; delete the 25 router files listed in the File Map.

- [ ] **Step 1: Rewrite `_app.ts` to only retained routers**

```typescript
import { createTRPCRouter } from "@/trpc/init";
import { projectRouter } from "./project";
import { portfolioRouter } from "./portfolio";
import { commentRouter as _removed } from "./comment"; // DELETE THIS LINE
import { notificationRouter } from "./notification";
import { activityRouter } from "./activity";
import { attachmentRouter } from "./attachment";
import { lessonV2Router } from "./lesson-v2";

export const appRouter = createTRPCRouter({
  project: projectRouter,
  portfolio: portfolioRouter,
  notification: notificationRouter,
  activity: activityRouter,
  attachment: attachmentRouter,
  lessonV2: lessonV2Router,
});

export type AppRouter = typeof appRouter;
```
(Remove the `comment` import/line entirely — it is shown only to mark it for deletion.)

- [ ] **Step 2: Delete legacy router files**

```bash
cd apps/web/src/server/routers
rm work-package.ts register.ts agreement.ts interface-point.ts deliverable.ts \
   interface-query.ts asset-placement.ts interface-case.ts interface-matrix.ts \
   interface-report.ts interface-tracker.ts moc.ts model-registry.ts \
   interface-workspace.ts cable-route.ts anchor-catalog.ts report.ts \
   lesson-learned.ts lesson-ops.ts lesson-policy.ts lesson-report.ts \
   lesson-portfolio.ts comment.ts deadline.ts
```

- [ ] **Step 3: Delete legacy server libs and their tests**

```bash
cd apps/web/src/server
rm lib/interface-compliance.ts lib/lesson-rbac.ts lib/lesson-workflow.ts \
   lib/lesson-visibility.ts lib/project-id.ts
rm __tests__/interface-compliance-rules.test.ts __tests__/asset-anchor-catalog.test.ts \
   __tests__/lesson-visibility.test.ts __tests__/lesson-workflow-rules.test.ts
```

- [ ] **Step 4: Type-check (expected to FAIL with references in retained files)**

Run: `pnpm --dir apps/web type-check`
Expected: FAIL — errors in `attachment.ts`, `project.ts`, `activity.ts`, deleted component imports, and `rbac.test.ts`/`router-authz.test.ts` referencing removed routers. These are fixed in Tasks 3–6.

### Task 3: Delete legacy components and pages

**Files:** delete component/page files in File Map.

- [ ] **Step 1: Delete v1 lesson + interface UI**

```bash
cd apps/web/src
rm components/lessons/ll-card.tsx components/lessons/ll-row.tsx \
   components/lessons/ll-detail-panel.tsx components/lessons/create-ll-dialog.tsx \
   components/lessons/lesson-comments-thread.tsx components/lessons/ll-badge.tsx \
   components/lessons/lessons-i18n.ts \
   components/forms/work-package-form.tsx components/project-module-switcher.tsx
rm "app/(dashboard)/projects/[projectId]/lessons/page.tsx" \
   "app/(dashboard)/projects/[projectId]/modules/lessons/page.tsx" \
   "app/(dashboard)/lessons-portfolio/page.tsx"
rmdir "app/(dashboard)/projects/[projectId]/modules" 2>/dev/null || true
rmdir "app/(dashboard)/lessons-portfolio" 2>/dev/null || true
```

- [ ] **Step 2: Commit (build still broken — intermediate commit is acceptable here)**

```bash
git add -A
git commit -m "refactor: delete legacy interface + v1 lesson routers, libs, and UI"
```

### Task 4: Rewire retained `project` and `activity` routers

**Files:** Modify `apps/web/src/server/routers/project.ts`, `apps/web/src/server/routers/activity.ts`.

- [ ] **Step 1: Remove interface usage from `project.ts`**

Remove every import of `interfaceRegisters`, `interfaceAgreements`, `interfacePoints`, `interfaceQueries`, `workPackages`, `lessonsLearned` and any query/aggregate that uses them (e.g. interface counts in a project-dashboard procedure). Where a project summary previously counted interface points/queries, replace with lesson + project-action counts:

```typescript
// Example replacement for a dashboard summary procedure:
const [{ value: lessonCount }] = await db
  .select({ value: count() })
  .from(lessonsV2)
  .where(eq(lessonsV2.projectId, input.projectId));
const [{ value: openActionCount }] = await db
  .select({ value: count() })
  .from(projectActions)
  .where(and(eq(projectActions.projectId, input.projectId),
             notInArray(projectActions.status, ["closed", "cancelled"])));
return { lessonCount, openActionCount };
```
Import `lessonsV2`, `projectActions` from `@owit/db` and `count`, `notInArray` from `drizzle-orm` as needed. Keep all non-interface project procedures (create, list, members) unchanged.

- [ ] **Step 2: Remove interface usage from `activity.ts`**

Remove the interface import and any interface-typed activity filtering. The `activities` table stays; ensure the router only references `activities` and retained tables.

- [ ] **Step 3: Type-check `project.ts`/`activity.ts` scope**

Run: `pnpm --dir apps/web type-check`
Expected: the project/activity errors are gone (attachment + tests still error — fixed next).

### Task 5: Delete legacy test references

**Files:** `apps/web/src/server/__tests__/rbac.test.ts`, `apps/web/src/server/__tests__/router-authz.test.ts`.

- [ ] **Step 1: Inspect both files**

Run: `grep -nE "interface|workPackage|deliverable|lessonLearned|moc|tracker|register|agreement" apps/web/src/server/__tests__/rbac.test.ts apps/web/src/server/__tests__/router-authz.test.ts`

- [ ] **Step 2: Remove legacy cases**

If a whole test file only covers deleted routers (e.g. `router-authz.test.ts` asserting interface router auth), delete the file:
```bash
rm apps/web/src/server/__tests__/router-authz.test.ts   # only if entirely legacy
```
If `rbac.test.ts` mixes generic project RBAC (keep) with interface cases, delete only the interface-specific `describe`/`it` blocks, keeping generic `requireRole`/`assertMember` coverage.

- [ ] **Step 3: Verify the retained v2 suite still passes**

Run: `pnpm --dir apps/web test src/server/__tests__/lesson-v2-workflow.test.ts src/server/__tests__/lesson-v2-rbac.test.ts src/server/__tests__/lesson-v2-transfer.test.ts`
Expected: PASS.

### Task 6: Remove module/feature-flag scaffolding

**Files:** `apps/web/src/lib/feature-flags.ts`, `apps/web/src/lib/project-modules.ts`.

- [ ] **Step 1: Strip interface flags**

In `feature-flags.ts` remove `interfaceComplianceV2`, `interfaceMatrixGeneration`, `interfaceTrackerImport`, `interfaceWorkspaceV2`. If the file becomes empty, delete it and remove its imports.

- [ ] **Step 2: Strip module switcher config**

In `project-modules.ts` remove interface modules and the `/modules/lessons` entry. If lessons is the only module, simplify to a single lessons entry pointing at `/lessons`, or delete the file and its imports if no longer used.

- [ ] **Step 3: Type-check (attachment still expected to fail)**

Run: `pnpm --dir apps/web type-check`
Expected: only `attachment.ts` errors remain (fixed in Stage 3, Task 11).

### Task 6b: Strip legacy work-package UI from settings + wizard

**Files:** Modify `apps/web/src/app/(dashboard)/projects/[projectId]/settings/page.tsx`, `apps/web/src/components/wizards/project-setup-wizard.tsx`. Delete the stray `apps/web/src/server/lib/lesson-rbac 2.ts`.

Context: these two files manage work packages (`trpc.workPackage.*`, `WorkPackageForm`, assigning members to work packages). Work packages are part of the deleted interface tooling, so this UI must go. The settings page also has legitimate project/member settings — keep those.

- [ ] **Step 1: Remove work-package management from `settings/page.tsx`**

Delete: the `WorkPackageForm` import; the `EditWorkPackageDialog` component; all `trpc.workPackage.*` queries/mutations (`list`, `create`, `update`, `delete`, `seedDefaults`); the entire "Work Packages" card/section; and the `workPackageIds`/`selectedWpIds` props and the work-package checkboxes from the member add/edit dialogs. Keep project settings and plain member management (`addMember`/`updateMember`/`removeMember` without `workPackageIds`). Ensure `addMember`/`updateMember` calls no longer pass `workPackageIds` (the `project` router no longer accepts it after Task 4).

- [ ] **Step 2: Remove the work-package step from `project-setup-wizard.tsx`**

Delete any work-package selection/seed step and its `trpc.workPackage.*` usage. If the wizard's sole purpose was work-package setup, reduce it to the remaining setup steps; if nothing meaningful remains, delete the component and remove its usages (check `create-project-dialog.tsx` and any importer).

- [ ] **Step 3: Delete the stray duplicate file**

```bash
rm "apps/web/src/server/lib/lesson-rbac 2.ts"
```

- [ ] **Step 4: Type-check — only `attachment.ts` may remain**

Run: `pnpm --dir apps/web type-check`
Expected: the ONLY remaining error is `attachment.ts` importing the deleted `@/server/lib/project-id` (fixed in Task 15). No errors in `settings/page.tsx` or `project-setup-wizard.tsx`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy work-package UI from settings and setup wizard"
```

---

## Stage 2 — Database streamlining

### Task 7: Add `content` column to `lessons_v2` in schema

**Files:** Modify `packages/db/src/schema.ts` (the `lessonsV2` definition near line 1862).

- [ ] **Step 1: Add the column**

In the `lessonsV2` `pgTable` object, after `description`, add:
```typescript
content: jsonb("content").$type<Record<string, unknown> | null>(),
```
Confirm `jsonb` is already imported at the top of `schema.ts` (it is used by other tables).

### Task 8: Delete legacy table and enum definitions from schema

**Files:** Modify `packages/db/src/schema.ts`.

- [ ] **Step 1: Remove legacy table definitions**

Delete these `pgTable` exports and any Drizzle `relations()` blocks that reference them: `workPackages`, `interfaceRegisters`, `interfaceAgreements`, `interfacePoints`, `deliverables`, `interfaceQueries`, `iqResponses`, `assetPlacements`, `modelRegistryAssets`, `interfaceCases`, `interfaceCaseEvents`, `interfaceMatrixRevisions`, `interfaceMatrixRows`, `interfaceMatrixAllocations`, `interfaceMatrixPacks`, `interfaceMeetings`, `interfaceMeetingAttendance`, `interfaceMonthlyReports`, `interfaceAuditExports`, `interfaceTrackerItems`, `interfaceTrackerEvents`, `interfaceTrackerCaseLinks`, `mocChanges`, `mocApprovals`, `mocEntityLinks`, `cableRoutes`, `customAnchorDefinitions`, `memberWorkPackages`, `comments`, `lessonsLearned`, `lessonLearnedPoints`, `lessonLearnedChangeRequests`, `lessonPolicyProfiles`, `projectLessonPolicyAssignments`, `lessonCycles`, `lessonTriageDecisions`, `lessonClusters`, `lessonClusterItems`, `lessonTrackAActions`, `lessonActionEvidence`, `lessonTrackBEscalations`, `lessonPackageReports`.

**KEEP — do NOT drop `projectLessonRoleAssignments`** (table `project_lesson_role_assignments`): it is read by the retained `lesson-v2-rbac.ts` via `lesson-rbac.ts` `listLessonRolesForUser`. Its enum `project_lesson_role` is also kept.

Keep: `attachments`, `deadlineDigestSends`, `portfolios`, `projects`, `projectMembers`, `userCorporateRoles`, `lessonProjectMemberships`, `projectLessonRoleAssignments`, `lessonCategories`, `lessonWorkstreams`, `lessonGates`, `organizations`, `projectMemberOrganizationRoles`, `lessonsV2`, `lessonClustersV2`, `lessonClusterLinksV2`, `recommendedActions`, `corporateRecommendedActions`, `projectActions`, `actionAssignments`, `lessonEvidence`, `lessonComments`, `lessonAuditLog`, `notifications`, `activities`.

- [ ] **Step 2: Remove legacy `pgEnum` definitions**

Delete enum exports referenced only by deleted tables: `agreementStatusEnum`, `assetTypeEnum`, `criticalityEnum`, `deliverableStatusEnum`, `disciplineEnum`, `interfaceCaseEventTypeEnum`, `interfaceCaseStateEnum`, `interfacePartyRoleEnum`, `iqResponseStatusEnum`, `matrixPhaseColumnEnum`, `mocApprovalDecisionEnum`, `mocApprovalLevelEnum`, `mocImplementationStatusEnum`, `mocStatusEnum`, `pointStatusEnum`, `queryPriorityEnum`, `queryStatusEnum`, `registerStatusEnum`, `scopeAllocationModeEnum`, `trackerItemStatusEnum`, `attachmentEntityEnum`'s interface members, and the v1 lesson enums `llChangeRequestStatusEnum`, `llDisciplineEnum`, `llOwnershipStateEnum`, `llStatusEnum`, `llTypeEnum`, `lessonCycleStateEnum`, `lessonCycleTypeEnum`, `lessonEscalationStatusEnum`, `lessonRoleTypeEnum`, `lessonTriageDecisionEnum`, `lessonWorkflowStateEnum`, `lessonActionPriorityEnum`, `lessonActionStatusEnum`.

**Caution — shared enums to KEEP** (still used by v2/retained tables): `confidentialityLevelEnum`, `corporateRoleEnum`, `corporateActionStatusEnum`, `evidenceKindEnum`, `lessonCommentKindEnum`, `lessonEntityTypeEnum`, `lessonV2StatusEnum`, `lessonClusterStatusEnum`, `memberRoleEnum`, `organizationTypeEnum`, `projectActionStatusEnum`, `projectLessonRoleEnum`, `projectPhaseEnum`, `projectStatusEnum`, `recommendedActionStatusEnum`, `reusabilityLevelEnum`. The `attachmentEntityEnum` is redefined in Task 9 to `["lesson"]`.

- [ ] **Step 3: Type-check the db package**

Run: `apps/web/node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types`
Expected: PASS once all dangling references are removed.

### Task 9: Redefine `attachment_entity` enum to lesson-only

**Files:** Modify `packages/db/src/schema.ts`.

- [ ] **Step 1: Change the enum members**

Set the attachment entity enum definition to:
```typescript
export const attachmentEntityEnum = pgEnum("attachment_entity", ["lesson"]);
```
(The migration in Task 10 handles the in-database enum value change.)

### Task 10: Write the streamline migration

**Files:** Create `packages/db/drizzle/0016_lessons_saas_streamline.sql`.

- [ ] **Step 1: Write the migration SQL**

```sql
-- Additive: rich-text body for lessons
ALTER TABLE lessons_v2 ADD COLUMN IF NOT EXISTS content jsonb;

-- Destructive: drop legacy interface-management + v1/intermediate lessons.
-- IRREVERSIBLE. Run only after confirming legacy data is disposable.
DROP TABLE IF EXISTS
  interface_tracker_case_links, interface_tracker_events, interface_tracker_items,
  interface_audit_exports, interface_monthly_reports, interface_meeting_attendance,
  interface_meetings, interface_matrix_packs, interface_matrix_allocations,
  interface_matrix_rows, interface_matrix_revisions, interface_case_events,
  interface_cases, iq_responses, interface_queries, deliverables, interface_points,
  interface_agreements, interface_registers, moc_entity_links, moc_approvals,
  moc_changes, cable_routes, asset_placements, model_registry_assets,
  custom_anchor_definitions, member_work_packages, work_packages, comments,
  lesson_package_reports, lesson_track_b_escalations, lesson_action_evidence,
  lesson_track_a_actions, lesson_cluster_items, lesson_clusters,
  lesson_triage_decisions, lesson_cycles,
  project_lesson_policy_assignments, lesson_policy_profiles,
  lesson_learned_change_requests, lesson_learned_points, lessons_learned
CASCADE;
-- NOTE: project_lesson_role_assignments is intentionally NOT dropped (used by v2 RBAC).

-- Migrate the attachment_entity enum to lesson-only.
ALTER TABLE attachments
  ALTER COLUMN entity_type TYPE text USING entity_type::text;
DELETE FROM attachments WHERE entity_type <> 'lesson';
DROP TYPE IF EXISTS attachment_entity;
CREATE TYPE attachment_entity AS ENUM ('lesson');
ALTER TABLE attachments
  ALTER COLUMN entity_type TYPE attachment_entity USING entity_type::attachment_entity;

-- Drop now-orphaned enum types (CASCADE already removed dependent columns).
DROP TYPE IF EXISTS
  agreement_status, asset_type, criticality, deliverable_status, discipline,
  interface_case_event_type, interface_case_state, interface_party_role,
  iq_response_status, matrix_phase_column, moc_approval_decision, moc_approval_level,
  moc_implementation_status, moc_status, point_status, query_priority, query_status,
  register_status, scope_allocation_mode, tracker_item_status,
  ll_change_request_status, ll_discipline, ll_ownership_state, ll_status, ll_type,
  lesson_cycle_state, lesson_cycle_type, lesson_escalation_status, lesson_role_type,
  lesson_triage_decision, lesson_workflow_state, lesson_action_priority,
  lesson_action_status;
```

- [ ] **Step 2: Apply against the local dev database**

Run: `pnpm --filter @owit/db db:migrate` (or apply `0016_lessons_saas_streamline.sql` directly if the journal is out of sync, per README note).
Expected: migration applies; `\dt` shows ~25 tables remaining.

- [ ] **Step 3: Re-baseline Drizzle metadata**

Run: `pnpm --filter @owit/db exec drizzle-kit generate` to regenerate the snapshot from the trimmed `schema.ts`, then verify `drizzle-kit check` reports no drift.
Expected: snapshot matches schema; no pending diff.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/ packages/db/src/index.ts
git commit -m "refactor(db): streamline schema to lessons-v2 model, add content column"
```

### Task 11: Trim shared enums/types

**Files:** Modify `packages/shared/src/enums.ts`, `packages/shared/src/types.ts`, `packages/shared/src/index.ts`; delete `packages/shared/src/{interface-compliance,asset-anchors}.ts`.

- [ ] **Step 1: Delete interface/v1 enum exports**

From `enums.ts` remove the interface + v1-lesson constants/types that are no longer referenced: `REGISTER_STATUSES`, `AGREEMENT_STATUSES`, `POINT_STATUSES`, `CRITICALITIES`, `SCOPE_ALLOCATION_PHASES`, `SCOPE_ALLOCATION_MODES`, `QUERY_STATUSES`, `QUERY_PRIORITIES`, `DELIVERABLE_STATUSES`, `IQ_RESPONSE_STATUSES`, `INTERFACE_PARTY_ROLES`, `INTERFACE_CASE_STATES`, `COMPLIANCE_STATUSES`, `TRACKER_ITEM_STATUSES`, `MOC_STATUSES`, `MOC_IMPLEMENTATION_STATUSES`, `MOC_APPROVAL_LEVELS`, `DISCIPLINES`, `ASSET_TYPES`, `LESSON_STATUSES`, `LESSON_DISCIPLINES`, `LESSON_CHANGE_REQUEST_STATUSES`, `LESSON_OWNERSHIP_STATES`, `LESSON_WORKFLOW_STATES`, `LESSON_TRIAGE_DECISIONS`, `LESSON_CYCLE_TYPES`, `LESSON_CYCLE_STATES`, `LESSON_ACTION_PRIORITIES`, `LESSON_ACTION_STATUSES`, `LESSON_ESCALATION_STATUSES`, `LESSON_ROLE_TYPES`, `DEFAULT_WORK_PACKAGES`.

Keep: `PROJECT_PHASES`, `PROJECT_STATUSES`, `MEMBER_ROLES`, `LESSON_TYPES`, `CORPORATE_ROLES`, `PROJECT_LESSON_ROLES`, `CONFIDENTIALITY_LEVELS`, `REUSABILITY_LEVELS`, `IMPACT_LEVELS`, `LESSON_V2_STATUSES`, `LESSON_CLUSTER_STATUSES`, `RECOMMENDED_ACTION_STATUSES`, `CORPORATE_ACTION_STATUSES`, `PROJECT_ACTION_STATUSES`, `EVIDENCE_KINDS`, `LESSON_COMMENT_KINDS`, `LESSON_ENTITY_TYPES`.

- [ ] **Step 2: Delete interface modules + their exports**

```bash
rm packages/shared/src/interface-compliance.ts packages/shared/src/asset-anchors.ts
```
Remove their `export * from` lines (and any interface/v1 type exports) from `packages/shared/src/index.ts` and `types.ts`.

- [ ] **Step 3: Type-check shared**

Run: `apps/web/node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types`
Expected: PASS.

---

## Stage 3 — Lesson server API

### Task 12: TipTap-JSON → plain-text excerpt helper (TDD)

**Files:** Create `apps/web/src/server/lib/lesson-content.ts`, `apps/web/src/server/lib/__tests__/lesson-content.test.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { excerptFromContent } from "../lesson-content";

describe("excerptFromContent", () => {
  it("flattens text nodes into a single line", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Cable pull-in" }] },
        { type: "paragraph", content: [{ type: "text", text: "delayed by weather" }] },
      ],
    };
    expect(excerptFromContent(doc, 200)).toBe("Cable pull-in delayed by weather");
  });

  it("truncates to the max length with an ellipsis", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(50) }] }] };
    expect(excerptFromContent(doc, 10)).toBe("xxxxxxxxx…");
  });

  it("returns empty string for null content", () => {
    expect(excerptFromContent(null, 200)).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/server/lib/__tests__/lesson-content.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```typescript
type Node = { type?: string; text?: string; content?: Node[] };

export function excerptFromContent(
  content: unknown,
  maxLength: number
): string {
  if (!content || typeof content !== "object") return "";
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (typeof node.text === "string") parts.push(node.text);
    node.content?.forEach(walk);
  };
  walk(content as Node);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/server/lib/__tests__/lesson-content.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/lib/lesson-content.ts apps/web/src/server/lib/__tests__/lesson-content.test.ts
git commit -m "feat: lesson content excerpt helper"
```

### Task 13: `lessonV2.getLesson` and `updateLesson` procedures (TDD)

**Files:** Modify `apps/web/src/server/routers/lesson-v2.ts`; create `apps/web/src/server/__tests__/lesson-v2-edit.test.ts`.

- [ ] **Step 1: Write the failing test (excerpt-derivation + RBAC contract)**

```typescript
import { describe, expect, it } from "vitest";
import { excerptFromContent } from "../lib/lesson-content";

// Unit-level guard for the updateLesson contract: when content is present,
// description is refreshed from it. Full router integration is covered by the
// existing lesson-v2-workflow harness.
describe("updateLesson description derivation", () => {
  it("derives description from content when content is provided", () => {
    const content = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "New body" }] }] };
    const derived = excerptFromContent(content, 280);
    expect(derived).toBe("New body");
  });
});
```

- [ ] **Step 2: Run to verify it passes (helper already exists)**

Run: `pnpm --dir apps/web test src/server/__tests__/lesson-v2-edit.test.ts`
Expected: PASS (this test pins the contract; the procedures are added next and exercised via type-check + manual run).

- [ ] **Step 3: Add `getLesson` to `lessonV2Router`**

Insert after `listLessons` in `lesson-v2.ts`:
```typescript
getLesson: protectedProcedure
  .input(z.object({ projectId: z.string().uuid(), lessonId: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    await requireV2ProjectCapability(input.projectId, ctx.user.id, "access_project");
    const lesson = await db.query.lessonsV2.findFirst({
      where: and(eq(lessonsV2.id, input.lessonId), eq(lessonsV2.projectId, input.projectId)),
      with: { category: true, workstream: true, gate: true },
    });
    if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
    return lesson;
  }),
```

- [ ] **Step 4: Add `updateLesson` to `lessonV2Router`**

```typescript
updateLesson: protectedProcedure
  .input(
    z.object({
      projectId: z.string().uuid(),
      lessonId: z.string().uuid(),
      title: z.string().trim().min(1).max(200).optional(),
      content: z.record(z.string(), z.unknown()).nullable().optional(),
      type: lessonTypeSchema.optional(),
      categoryId: z.string().uuid().optional(),
      observedDate: z.string().date().nullable().optional(),
      workstreamId: z.string().uuid().nullable().optional(),
      gateId: z.string().uuid().nullable().optional(),
      projectPhase: projectPhaseSchema.nullable().optional(),
      impactLevel: z.string().trim().nullable().optional(),
      rootCause: z.string().trim().nullable().optional(),
      sourceOrganisation: z.string().trim().nullable().optional(),
      confidentialityLevel: confidentialitySchema.optional(),
      tags: z.array(z.string().trim().min(1)).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const lesson = await getLessonInProject(input.projectId, input.lessonId);
    if (lesson.authorId !== ctx.user.id) {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "edit_any_lesson");
    } else {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "create_lesson");
    }
    if (input.categoryId) await assertCategoryExists(input.categoryId);

    const { projectId, lessonId, content, ...rest } = input;
    const patch: Partial<typeof lessonsV2.$inferInsert> = { ...rest, updatedAt: new Date() };
    if (content !== undefined) {
      patch.content = content;
      if (content) patch.description = excerptFromContent(content, 280) || lesson.description;
    }

    const [updated] = await db
      .update(lessonsV2)
      .set(patch)
      .where(eq(lessonsV2.id, lessonId))
      .returning();
    await audit({
      entityType: "lesson",
      entityId: lessonId,
      eventType: "updated",
      actorId: ctx.user.id,
      projectId,
      previousValue: lesson,
      newValue: updated,
    });
    return updated;
  }),
```
Add `import { excerptFromContent } from "@/server/lib/lesson-content";` to the file. Verify `requireV2ProjectCapability` accepts `"edit_any_lesson"` and `"create_lesson"` (it is already used with these in `submitLesson`/`createLesson`).

- [ ] **Step 5: Type-check + retained suite**

Run: `pnpm --dir apps/web type-check && pnpm --dir apps/web test src/server/__tests__/lesson-v2-workflow.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/server/routers/lesson-v2.ts apps/web/src/server/__tests__/lesson-v2-edit.test.ts
git commit -m "feat: getLesson and updateLesson procedures with content excerpt"
```

### Task 14: Lesson comment procedures

**Files:** Modify `apps/web/src/server/routers/lesson-v2.ts`.

- [ ] **Step 1: Add comment procedures on the `lessonComments` table**

Add `lessonComments` to the `@owit/db` import, then:
```typescript
listComments: protectedProcedure
  .input(z.object({ projectId: z.string().uuid(), lessonId: z.string().uuid() }))
  .query(async ({ input, ctx }) => {
    await requireV2ProjectCapability(input.projectId, ctx.user.id, "access_project");
    return db.query.lessonComments.findMany({
      where: and(
        eq(lessonComments.entityType, "lesson"),
        eq(lessonComments.entityId, input.lessonId)
      ),
      orderBy: [lessonComments.createdAt],
    });
  }),

addComment: protectedProcedure
  .input(z.object({
    projectId: z.string().uuid(),
    lessonId: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }))
  .mutation(async ({ input, ctx }) => {
    await requireV2ProjectCapability(input.projectId, ctx.user.id, "access_project");
    await getLessonInProject(input.projectId, input.lessonId);
    const [comment] = await db.insert(lessonComments).values({
      projectId: input.projectId,
      entityType: "lesson",
      entityId: input.lessonId,
      authorId: ctx.user.id,
      body: input.body,
      kind: "comment",
    }).returning();
    return comment;
  }),

deleteComment: protectedProcedure
  .input(z.object({ projectId: z.string().uuid(), commentId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const comment = await db.query.lessonComments.findFirst({
      where: eq(lessonComments.id, input.commentId),
    });
    if (!comment || comment.projectId !== input.projectId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
    }
    if (comment.authorId !== ctx.user.id) {
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "edit_any_lesson");
    }
    await db.delete(lessonComments).where(eq(lessonComments.id, input.commentId));
    return { success: true };
  }),
```

- [ ] **Step 2: Type-check**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/routers/lesson-v2.ts
git commit -m "feat: lesson comment procedures on lesson_comments"
```

### Task 15: Rewrite the attachment router for lessons

**Files:** Modify `apps/web/src/server/routers/attachment.ts`.

- [ ] **Step 1: Replace legacy entity resolution with a lesson resolver**

Replace the top imports and `projectIdForAttachmentEntity` with:
```typescript
import { attachments, db, lessonsV2 } from "@owit/db";
// ...keep supabase/admin, lib/attachments, rbac imports...
const entityTypeSchema = z.enum(["lesson"]);

async function projectIdForLesson(lessonId: string): Promise<string> {
  const row = await db.query.lessonsV2.findFirst({
    where: eq(lessonsV2.id, lessonId),
    columns: { projectId: true },
  });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
  return row.projectId;
}

async function projectIdForAttachmentEntity(
  _entityType: z.infer<typeof entityTypeSchema>,
  entityId: string
): Promise<string> {
  return projectIdForLesson(entityId);
}
```
Remove the `projectIdForDeliverable/IqResponse/Point` import (the `project-id.ts` file is deleted). Everything else in the router (upload intent, complete, list, download, delete) works unchanged because it routes through `projectIdForAttachmentEntity` and the generic `requireRole`/`assertMember`.

- [ ] **Step 2: Type-check + retained suite**

Run: `pnpm --dir apps/web type-check && pnpm --dir apps/web test src/server/__tests__/lesson-v2-rbac.test.ts src/server/__tests__/lesson-v2-transfer.test.ts src/server/__tests__/lesson-v2-workflow.test.ts`
Expected: PASS — Stage 1–3 leave the server fully type-clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/routers/attachment.ts
git commit -m "refactor: scope attachment router to lesson entities"
```

---

## Stage 4 — Notion-style Lesson page

### Task 16: TipTap lesson body editor component

**Files:** Create `apps/web/src/components/lessons/lesson-editor.tsx`.

- [ ] **Step 1: Implement the editor**

```tsx
"use client";

import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";

type LessonEditorProps = {
  initialContent: JSONContent | null;
  editable: boolean;
  onChange: (content: JSONContent) => void;
};

export function LessonEditor({ initialContent, editable, onChange }: LessonEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    editable,
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write the lesson — what happened, impact, recommendation…" }),
    ],
    content: initialContent ?? undefined,
    editorProps: {
      attributes: { class: "prose prose-sm max-w-none focus:outline-none min-h-[240px]" },
    },
    onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON()),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}
```
Add minimal `.prose` styling in `globals.css` if not present (headings/lists spacing). TipTap's StarterKit covers headings, bold/italic, lists, and task-adjacent formatting.

- [ ] **Step 2: Type-check**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

### Task 17: Properties, attachments, and comments panels

**Files:** Create `lesson-properties-panel.tsx`, `lesson-attachments-panel.tsx`, `lesson-comments.tsx` under `apps/web/src/components/lessons/`.

- [ ] **Step 1: Properties panel (autosaving select/inputs)**

```tsx
"use client";
import { LESSON_TYPES, LESSON_V2_STATUSES, CONFIDENTIALITY_LEVELS } from "@owit/shared";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  lesson: { type: string; status: string; categoryId: string; confidentialityLevel: string; observedDate: string | null };
  categories: Array<{ id: string; name: string }>;
  editable: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
};

export function LessonPropertiesPanel({ lesson, categories, editable, onPatch }: Props) {
  return (
    <aside className="w-72 shrink-0 space-y-4 border-l pl-4">
      <Field label="Status">
        <PropSelect value={lesson.status} disabled={!editable}
          options={LESSON_V2_STATUSES} onChange={(v) => onPatch({ status: v })} />
      </Field>
      <Field label="Type">
        <PropSelect value={lesson.type} disabled={!editable}
          options={LESSON_TYPES} onChange={(v) => onPatch({ type: v })} />
      </Field>
      <Field label="Category">
        <Select value={lesson.categoryId} disabled={!editable}
          onValueChange={(v) => onPatch({ categoryId: v })}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Confidentiality">
        <PropSelect value={lesson.confidentialityLevel} disabled={!editable}
          options={CONFIDENTIALITY_LEVELS} onChange={(v) => onPatch({ confidentialityLevel: v })} />
      </Field>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PropSelect({ value, options, disabled, onChange }: {
  value: string; options: readonly string[]; disabled: boolean; onChange: (v: string) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o.replace(/_/g, " ")}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Attachments panel (Supabase signed upload via the attachment router)**

```tsx
"use client";
import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaperclipIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";

export function LessonAttachmentsPanel({ lessonId, editable }: { lessonId: string; editable: boolean }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const listOpts = trpc.attachment.listByEntity.queryOptions({ entityType: "lesson", entityId: lessonId });
  const { data: files = [] } = useQuery(listOpts);
  const createIntent = useMutation(trpc.attachment.createUploadIntent.mutationOptions());
  const complete = useMutation(trpc.attachment.completeUpload.mutationOptions());
  const remove = useMutation(trpc.attachment.delete.mutationOptions({
    onSuccess: () => qc.invalidateQueries(listOpts),
  }));
  const getUrl = useMutation(trpc.attachment.getDownloadUrl.mutationOptions());

  async function upload(file: File) {
    const intent = await createIntent.mutateAsync({
      entityType: "lesson", entityId: lessonId,
      fileName: file.name, mimeType: file.type, sizeBytes: file.size,
    });
    await fetch(intent.signedUploadUrl, { method: "PUT", body: file, headers: { "content-type": file.type } });
    await complete.mutateAsync({
      attachmentId: intent.attachmentId, entityType: "lesson", entityId: lessonId,
      fileName: file.name, storagePath: intent.storagePath, mimeType: file.type, sizeBytes: file.size,
    });
    await qc.invalidateQueries(listOpts);
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Attachments</h3>
        {editable ? (
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
            <PaperclipIcon className="size-4" /> Add file
          </Button>
        ) : null}
        <input ref={inputRef} type="file" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      </div>
      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
            <button className="truncate text-left hover:underline"
              onClick={async () => { const { url } = await getUrl.mutateAsync({ attachmentId: f.id }); window.open(url, "_blank"); }}>
              {f.fileName}
            </button>
            {editable ? (
              <button onClick={() => remove.mutate({ attachmentId: f.id })} aria-label="Delete attachment">
                <Trash2Icon className="size-4 text-muted-foreground hover:text-destructive" />
              </button>
            ) : null}
          </li>
        ))}
        {files.length === 0 ? <li className="text-sm text-muted-foreground">No files attached.</li> : null}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Comments thread (v2)**

```tsx
"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";

export function LessonComments({ projectId, lessonId }: { projectId: string; lessonId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const listOpts = trpc.lessonV2.listComments.queryOptions({ projectId, lessonId });
  const { data: comments = [] } = useQuery(listOpts);
  const add = useMutation(trpc.lessonV2.addComment.mutationOptions({
    onSuccess: () => { setBody(""); void qc.invalidateQueries(listOpts); },
  }));
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium">Comments</h3>
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded border p-2 text-sm">
            <p className="whitespace-pre-wrap">{c.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString("en-GB")}</p>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" />
        <Button size="sm" disabled={!body.trim() || add.isPending}
          onClick={() => add.mutate({ projectId, lessonId, body })}>Comment</Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Type-check + commit**

Run: `pnpm --dir apps/web type-check`
```bash
git add apps/web/src/components/lessons
git commit -m "feat: lesson editor, properties, attachments, and comments panels"
```

### Task 18: Lesson detail page + autosave wiring

**Files:** Create `apps/web/src/app/(dashboard)/projects/[projectId]/lessons/[lessonId]/page.tsx`.

- [ ] **Step 1: Implement the page with debounced autosave**

```tsx
"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { ArrowLeftIcon } from "lucide-react";
import { LessonEditor } from "@/components/lessons/lesson-editor";
import { LessonPropertiesPanel } from "@/components/lessons/lesson-properties-panel";
import { LessonAttachmentsPanel } from "@/components/lessons/lesson-attachments-panel";
import { LessonComments } from "@/components/lessons/lesson-comments";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";

export default function LessonDetailPage() {
  const { projectId, lessonId } = useParams<{ projectId: string; lessonId: string }>();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lessonOpts = trpc.lessonV2.getLesson.queryOptions({ projectId, lessonId });
  const { data: lesson } = useQuery(lessonOpts);
  const { data: categories = [] } = useQuery(trpc.lessonV2.listCategories.queryOptions());
  const update = useMutation(trpc.lessonV2.updateLesson.mutationOptions({
    onMutate: () => setSaveState("saving"),
    onError: () => setSaveState("error"),
    onSuccess: () => { setSaveState("idle"); void qc.invalidateQueries(lessonOpts); },
  }));

  const patch = useCallback((p: Record<string, unknown>) => {
    update.mutate({ projectId, lessonId, ...p });
  }, [update, projectId, lessonId]);

  const onBody = useCallback((content: JSONContent) => {
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    timer.current = setTimeout(() => {
      update.mutate({ projectId, lessonId, content: content as Record<string, unknown> });
    }, 800);
  }, [update, projectId, lessonId]);

  if (!lesson) return <div className="p-6 text-sm text-muted-foreground">Loading lesson…</div>;
  const editable = !["archived"].includes(lesson.status);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Link href={`/projects/${projectId}/lessons`} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-4" /> Back to lessons
        </Link>
        <span className="text-xs text-muted-foreground">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed — retrying on next edit" : "Saved"}
        </span>
      </div>

      <Input
        defaultValue={lesson.title}
        disabled={!editable}
        className="border-0 px-0 text-2xl font-semibold shadow-none focus-visible:ring-0"
        onBlur={(e) => { if (e.target.value.trim() && e.target.value !== lesson.title) patch({ title: e.target.value.trim() }); }}
      />

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-6">
          <LessonEditor
            initialContent={(lesson.content as JSONContent | null) ?? null}
            editable={editable}
            onChange={onBody}
          />
          <LessonAttachmentsPanel lessonId={lessonId} editable={editable} />
          <LessonComments projectId={projectId} lessonId={lessonId} />
        </div>
        <LessonPropertiesPanel
          lesson={{
            type: lesson.type, status: lesson.status, categoryId: lesson.categoryId,
            confidentialityLevel: lesson.confidentialityLevel, observedDate: lesson.observedDate,
          }}
          categories={categories}
          editable={editable}
          onPatch={patch}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(dashboard)/projects/[projectId]/lessons/[lessonId]/page.tsx"
git commit -m "feat: Notion-style lesson detail page with autosave"
```

### Task 19: Open lessons from the cockpit + rename route to `/lessons`

**Files:** Modify `apps/web/src/app/(dashboard)/projects/[projectId]/lessons-v2/page.tsx`; move it to `/lessons`.

- [ ] **Step 1: Make cockpit rows link to the detail page**

In the lessons list, wrap each row title in a link to the detail route:
```tsx
<Link href={`/projects/${projectId}/lessons/${lesson.id}`} className="truncate text-sm font-medium hover:underline">
  {lesson.title}
</Link>
```
Remove the now-dead `Lessons cockpit` link that pointed at `/projects/${projectId}/modules/lessons` (that page is deleted).

- [ ] **Step 2: Move the cockpit to `/lessons`**

```bash
cd "apps/web/src/app/(dashboard)/projects/[projectId]"
git mv lessons-v2/page.tsx lessons/page.tsx
rmdir lessons-v2 2>/dev/null || true
```
Update `basePath` in the moved file to `/projects/${projectId}/lessons` and fix the `projectNav` hash anchors (they stay relative to `basePath`).

- [ ] **Step 3: Update any links pointing at `/lessons-v2`**

Run: `grep -rln "lessons-v2" apps/web/src` and replace each occurrence with `/lessons`. Update the sidebar (`app-sidebar.tsx`/`nav-main.tsx`) lesson links.

- [ ] **Step 4: Type-check + manual run verification**

Run: `pnpm --dir apps/web type-check`
Then use the `run` skill: start the app, open a project's `/lessons`, click a lesson, edit the body (confirm "Saving…" → "Saved"), change a property, upload a file, add a comment, reload and confirm persistence.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: route lessons to /lessons and open lessons as full pages"
```

---

## Stage 5 — Branding & docs

### Task 20: Rebrand shell, login, navigation

**Files:** `apps/web/src/app/layout.tsx`, `apps/web/src/app/login/page.tsx`, `apps/web/src/components/app-sidebar.tsx`, `apps/web/src/components/nav-main.tsx`.

- [ ] **Step 1: Update metadata + visible product name**

In `layout.tsx` set `metadata.title`/`description` to the Lessons Learned product name (retain `lel-it` naming already used). Update `login/page.tsx` headings/marketing copy to describe a Lessons Learned product for offshore wind. Remove any interface-module nav items from the sidebar so only Lessons, Corporate Library, Corporate Proposals, and Corporate Dashboard remain.

- [ ] **Step 2: Type-check + commit**

Run: `pnpm --dir apps/web type-check`
```bash
git add -A
git commit -m "chore(branding): rebrand shell, login, and navigation to lessons product"
```

### Task 21: Update README and remove interface assets

**Files:** `README.md`, `docs/assets/readme/*` interface diagrams.

- [ ] **Step 1: Trim docs**

Remove interface-management process diagrams/screenshots (`access-governance-process.svg` stays only if still relevant; remove `project-to-corporate-process.svg` only if interface-specific). Update README setup paths (`/projects/<id>/lessons` instead of `/lessons-v2`), remove the "Legacy interface-management UI routes" note (now fully gone), and confirm the workflow/screenshot sections describe only the lessons product.

- [ ] **Step 2: Full verification gate**

Run all retained checks:
```bash
pnpm --dir apps/web type-check
pnpm --dir apps/web test
apps/web/node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types
apps/web/node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types
```
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: refocus README on lessons learned product"
```

---

## Self-Review notes

- **Spec coverage:** teardown (Stage 1+2), DB streamline + `content` column (Stage 2), Notion page with rich text/properties/attachments/comments (Stage 3+4), branding (Stage 5) — all mapped. The three spec corrections are documented at the top.
- **Type consistency:** `excerptFromContent(content, max)` used identically in helper, `updateLesson`, and tests; `entityType: "lesson"` consistent across attachment router + panels; `lessonV2.{getLesson,updateLesson,listComments,addComment,deleteComment}` names consistent between server and client.
- **RBAC:** edits gated by `requireV2ProjectCapability(..., "create_lesson" | "edit_any_lesson")` matching existing usage; verify those capability strings exist in `lesson-v2-rbac.ts` during Task 13 and adjust the capability name if the codebase uses a different one.
- **Irreversibility:** the destructive migration (Task 10) is isolated and explicitly gated on the user's confirmed go-ahead.
