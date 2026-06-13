# Handover — Lessons Learned SaaS refocus (for Codex)

You are continuing a multi-stage refactor already in progress. Read this whole
file before touching anything. The detailed task-by-task plan is the source of
truth; this file tells you where execution stopped and the gotchas that aren't
obvious from the plan.

## Working directory

```
/Users/niels_muck/Library/Mobile Documents/com~apple~CloudDocs/Projects /Offshore Wind Interface Tool
```
Note the spaces and the trailing space in `Projects `. Always quote paths.

## What this project is

A pnpm monorepo (Next.js 16 + tRPC v11 + TanStack Query + Drizzle/Postgres +
Tailwind v4). It is being refocused from an "Interface Management Tool" into a
**Lessons Learned** product. All interface-management and v1/intermediate-lessons
code and tables have been removed; the canonical model is **Lessons v2**
(`lessons_v2`, `recommended_actions`, `project_actions`, `lesson_evidence`,
`lesson_comments`, `lesson_audit_log`, corporate library/dashboard).

## Authoritative documents (read these)

- Spec: `docs/superpowers/specs/2026-06-13-lessons-learned-saas-refocus-design.md`
- Plan (task-by-task, with exact code): `docs/superpowers/plans/2026-06-13-lessons-learned-saas-refocus.md`

## Git state

- Branch: `refocus/lessons-learned-saas` (stay on it; **do not push**)
- HEAD at handover: `4988042`, working tree clean.
- Commit after **every** task with a clear message (the plan gives messages).

## DONE (Stages 1–2, Tasks 1–11 + 6b)

- **Stage 1 — code teardown (committed):** deleted 25 legacy tRPC routers and
  unregistered them from `apps/web/src/server/routers/_app.ts` (retained:
  `project, portfolio, notification, activity, attachment, lessonV2`); deleted
  legacy server libs/tests; deleted v1 lesson + interface UI; rewired
  `project.ts`/`activity.ts` off interface tables; removed work-package UI from
  `settings/page.tsx` and deleted `project-setup-wizard.tsx`; stripped interface
  feature flags + module-switcher; removed dead `/lessons-portfolio` links and
  interface excel exports. TipTap deps installed.
- **Stage 2 — database (committed + APPLIED to local DB):** added
  `lessons_v2.content jsonb`; deleted ~45 legacy tables + their enums from
  `packages/db/src/schema.ts`; set `attachment_entity` enum to `['lesson']`;
  trimmed `packages/shared` enums/types. Migration
  `packages/db/drizzle/0016_lessons_saas_streamline.sql` was **already applied**
  to the local Supabase Postgres (`127.0.0.1:54322`). Verified final state:
  **25 tables, 20 enums, 47 demo lessons intact**, `content jsonb` present,
  `attachment_entity = ['lesson']`.

### Current build state
`pnpm --dir apps/web type-check` fails **only** in
`apps/web/src/server/routers/attachment.ts` (it still imports the deleted
`@/server/lib/project-id` and uses the old entity enum). **This is expected** and
is fixed by Task 15 below. Both `packages/db` and `packages/shared` type-check
clean. Retained test suite (29 tests across 5 files) passes.

## OUTSTANDING (do these, in order)

Execute **Tasks 12 → 21** from the plan. Summary:

- **Stage 3 — server API**
  - Task 12: `apps/web/src/server/lib/lesson-content.ts` — `excerptFromContent(content, max)` (TipTap-JSON → plain text). TDD; test file in the plan.
  - Task 13: add `lessonV2.getLesson` and `lessonV2.updateLesson` (updates `content` + properties, refreshes `description` excerpt, writes `lesson_audit_log`).
  - Task 14: add `lessonV2.listComments` / `addComment` / `deleteComment` on the `lesson_comments` table (it exists but currently has no router).
  - Task 15: **rewrite** `apps/web/src/server/routers/attachment.ts` to support `entityType = ['lesson']` only, resolving `projectId` via `lessons_v2` (the old `project-id.ts` is gone). After this, `pnpm --dir apps/web type-check` must be fully clean.
- **Stage 4 — Notion-style lesson page**
  - Task 16: `lesson-editor.tsx` (TipTap StarterKit + Link + Placeholder).
  - Task 17: `lesson-properties-panel.tsx`, `lesson-attachments-panel.tsx`, `lesson-comments.tsx`.
  - Task 18: `app/(dashboard)/projects/[projectId]/lessons/[lessonId]/page.tsx` with debounced autosave.
  - Task 19: make cockpit rows open the detail page; `git mv` the cockpit from `lessons-v2/page.tsx` to `lessons/page.tsx`; replace all `/lessons-v2` links (incl. sidebar) with `/lessons`. Then manually run the app and confirm: open a lesson, edit body (Saving→Saved), change a property, upload a file, add a comment, reload persists.
- **Stage 5 — branding/docs**
  - Task 20: rebrand `layout.tsx`, `login/page.tsx`, sidebar/nav to the lessons product.
  - Task 21: update `README.md`, remove interface diagrams from `docs/assets/readme/`, run the full verification gate.

After Task 21: do a final whole-branch code review, then use your judgment on
merge/PR (the user has not asked to push or merge yet — ask before pushing).

## Critical gotchas / non-obvious deviations (respect these)

1. **The DB is already streamlined — do NOT re-apply `0016` and do NOT re-run the
   table/enum drops.** If you need a fresh DB, apply migration files directly
   (`psql -f`), per the README; drizzle's journal is intentionally out of sync
   (snapshots stop at `0013`). A full drizzle re-baseline/squash was deferred on
   purpose — don't attempt it unless explicitly asked.
2. **Do NOT drop or remove these — they are used by retained code/columns:**
   `project_lesson_role_assignments` table, and enums `ll_type` (→
   `lessons_v2.type`), `lesson_role_type` (→ `project_lesson_role_assignments`),
   `interface_party_role` (→ `project_member_organization_roles.interface_role`).
   `apps/web/src/server/lib/lesson-rbac.ts` was kept (trimmed) on purpose because
   `lesson-v2-rbac.ts` depends on its `listLessonRolesForUser`.
3. **`lessons_v2.content` is `jsonb` (nullable).** `description` stays `not null`
   and is refreshed from `content` via `excerptFromContent(content, 280)` on
   update (Tasks 12–13). Don't drop `description`.
4. **Attachments use Supabase Storage** bucket `attachments` via the
   `attachment` router (signed upload: `createUploadIntent` → client `PUT` to the
   signed URL → `completeUpload`). Bind to `entityType: "lesson"`, `entityId:
   lessonId`. Generic project RBAC (`requireRole`/`assertMember` in
   `server/lib/rbac.ts`) gates it — keep using that.
5. **Verify capability strings before relying on them.** Task 13/14 use
   `requireV2ProjectCapability(projectId, userId, "...")` with `"access_project"`,
   `"create_lesson"`, `"edit_any_lesson"`. Confirm these exist in
   `apps/web/src/server/lib/lesson-v2-rbac.ts` (they are already used by
   `createLesson`/`submitLesson`); if a name differs, match the existing one.
6. **Route rename happens in Task 19, not before.** Until then the cockpit lives
   at `/projects/[id]/lessons-v2`; `lib/project-modules.ts` temporarily points at
   `/lessons-v2`. Task 19 moves everything to `/lessons`.
7. **TipTap is already installed** (`@tiptap/react`, `@tiptap/pm`,
   `@tiptap/starter-kit`, `@tiptap/extension-link`,
   `@tiptap/extension-placeholder`). Use `immediatelyRender: false` (Next SSR).

## Verification commands

```bash
# from repo root
pnpm --dir apps/web type-check                 # must be clean after Task 15
pnpm --dir apps/web test                       # retained + new tests
apps/web/node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types
apps/web/node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types

# local DB (Supabase must be running on 127.0.0.1:54322)
cd packages/db && set -a && . ./.env && set +a
psql "$DATABASE_URL" -tAc "select count(*) from information_schema.tables where table_schema='public';"  # expect 25
```

## Working agreement

- One task at a time; verify (type-check/tests) before committing; commit after
  each task; never push or merge without asking the user first.
- If you find a plan instruction that conflicts with the code (the plan has a few
  documented corrections already — see "Deviations from the design spec" at the
  top of the plan), prefer correctness, fix the smallest thing, and note it in
  the commit message.
