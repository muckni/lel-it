# Lessons Learned SaaS Refocus — Design

Date: 2026-06-13
Status: Approved for planning

## Goal

Refocus the application from an Offshore Wind Interface Management Tool into a
leading **Lessons Learned** product for the offshore wind industry. Remove every
legacy interface-management capability and the superseded lessons generations,
streamline the database to a single canonical lessons model, and give Lessons a
Notion-style full-page experience with rich-text bodies and file attachments.

## Decisions (locked)

1. **SaaS scope = product refocus only.** Keep the current Supabase auth +
   organization/role access model. No self-serve signup, billing, or new
   tenant-provisioning work in this round.
2. **Lessons model = v2 only.** `lessons_v2` and its surrounding tables are the
   single canonical model. The v1 (`lessons_learned`) and the intermediate
   cycle/track system are deleted entirely (code and tables).
3. **Editor = rich text + properties + files.** Pragmatic Notion feel: rich-text
   body (TipTap), a page properties panel, and file attachments. Not a full
   block/slash-menu engine.
4. **Database teardown = drop legacy tables.** A migration drops all legacy
   interface-management and superseded-lessons tables/enums. Irreversible.
5. **Body storage =** new `content jsonb` column on `lessons_v2`; existing
   `description` retained as an auto-derived plain-text excerpt for list previews
   and search. No destructive data migration.
6. **Navigation =** lessons move to clean `/projects/[projectId]/lessons` URLs
   (v1 surfaces at `/lessons` and `/modules/lessons` are removed first).

## Non-goals

- Billing, subscriptions, self-serve org signup, tenant provisioning.
- Full block-based editor (drag blocks, slash menu, embeds).
- Preserving any interface-management or v1/intermediate-lessons functionality.
- Backfilling historical interface data; legacy tables are dropped, not archived.

## Current State (as found)

- pnpm monorepo: `apps/web` (Next.js 16, tRPC v11, TanStack Query, Tailwind v4,
  shadcn-style UI), `packages/db` (Drizzle + Postgres/Supabase),
  `packages/shared` (enums/types). ~70 tables across three eras.
- **Live engine:** `lesson-v2` router (lessons, clusters, recommended actions,
  corporate library, project actions, dashboard) at `/projects/[id]/lessons-v2`,
  `/corporate/*`, `/lessons-portfolio`.
- **Legacy interface layer (delete):** routers `workPackage, register, agreement,
  interfacePoint, deliverable, interfaceQuery, assetPlacement, interfaceCase,
  interfaceMatrix, interfaceReport, interfaceTracker, moc, modelRegistry,
  interfaceWorkspace, cableRoute, anchorCatalog`, and `report` (interface report).
- **Superseded lessons (delete):** routers `lessonLearned, lessonOps,
  lessonPolicy, lessonReport`; components `ll-card`, `ll-row`,
  `ll-detail-panel`, `create-ll-dialog`; pages `/projects/[id]/lessons` and
  `/projects/[id]/modules/lessons` (both built on the v1 model — they reference
  `interfacePoint`, `workPackage`, `ownershipState`).
- **Existing reusable infra:** generic `attachment` router (Supabase Storage
  signed upload: `createUploadIntent` / `completeUpload` / `listByEntity` /
  `getDownloadUrl` / `delete`); `lesson_evidence`, `lesson_comments`,
  `lesson_audit_log` tables already support v2 entities.

## Architecture

### A. Code teardown

Remove, in `apps/web/src/server/routers/`, every interface-management router and
the superseded-lessons routers listed above, and unregister them from
`_app.ts`. Remove their dedicated server libs (`interface-compliance`,
`lesson-rbac`, `lesson-workflow`, `lesson-visibility` and the matching tests) and
shared modules (`packages/shared/src/interface-compliance.ts`,
`asset-anchors.ts`, plus any interface-only enums in `enums.ts`/`types.ts`).
Delete the v1 lesson components, the v1 lesson pages, `work-package-form`, the
`project-module-switcher`, and the corresponding `feature-flags` /
`project-modules` entries.

Keep: `lesson-v2`, `project`, `portfolio`, `notification`, `activity`, and
`attachment` (rewritten — see below) routers; shared auth, sidebar, and UI
primitives. The generic `comment` router, the `deadline` router, and the
`lesson-portfolio` router are **deleted** — they are built on legacy/v1 tables
(`comments`, `deliverables`, `lessonsLearned`, `lessonCycles`,
`lessonTrackAActions`). The `project` and `activity` routers are edited to drop
their interface-table usage.

After removal, `pnpm --dir apps/web type-check` and the retained tests
(`lesson-v2-workflow`, `lesson-v2-rbac`, `lesson-v2-transfer`) must pass with no
references to deleted symbols.

### B. Database streamlining

Target: ~70 → ~25 tables. One new Drizzle migration drops legacy objects, and
the schema/migration history is squashed to a clean baseline.

**Drop (interface management):** `interface_registers`, `interface_agreements`,
`interface_points`, `interface_queries`, `iq_responses`, `interface_cases`,
`interface_case_events`, `interface_matrix_revisions`, `interface_matrix_rows`,
`interface_matrix_allocations`, `interface_matrix_packs`, `interface_meetings`,
`interface_meeting_attendance`, `interface_monthly_reports`,
`interface_audit_exports`, `interface_tracker_items`, `interface_tracker_events`,
`interface_tracker_case_links`, `moc_changes`, `moc_approvals`,
`moc_entity_links`, `cable_routes`, `asset_placements`, `model_registry_assets`,
`deliverables`, `work_packages`, `member_work_packages`,
`custom_anchor_definitions` — plus their enums (e.g. `agreement_status`,
`asset_type`, `criticality`, `deliverable_status`, `interface_case_*`,
`interface_party_role`, `iq_response_status`, `matrix_phase_column`,
`moc_*`, `point_status`, `query_*`, `register_status`, `scope_allocation_mode`,
`tracker_item_status`).

**Drop (superseded lessons):** `lessons_learned`, `lesson_learned_points`,
`lesson_learned_change_requests`, `lesson_policy_profiles`,
`project_lesson_policy_assignments`, `project_lesson_role_assignments`,
`lesson_cycles`, `lesson_triage_decisions`, `lesson_clusters` (v1),
`lesson_cluster_items`, `lesson_track_a_actions`, `lesson_action_evidence`,
`lesson_track_b_escalations`, `lesson_package_reports` — plus their v1-only enums
(`ll_*`, `lesson_cycle_*`, `lesson_triage_decision`, `lesson_escalation_status`,
`lesson_role_type`, `lesson_workflow_state`, etc., excluding enums still used by
v2).

**Keep (canonical):** `projects`, `project_members`, `organizations`,
`project_member_organization_roles`, `user_corporate_roles`,
`lesson_project_memberships`, `lesson_categories`, `lesson_workstreams`,
`lesson_gates`, `lessons_v2`, `lesson_clusters_v2`, `lesson_cluster_links_v2`,
`recommended_actions`, `corporate_recommended_actions`, `project_actions`,
`action_assignments`, `lesson_evidence`, `lesson_comments`, `lesson_audit_log`,
`attachments`, `notifications`, `activities`, `portfolios`,
`deadline_digest_sends`.

**Enum care:** before dropping an enum, confirm no retained table references it
(several enums — `discipline`, `project_phase`, `confidentiality_level`,
`reusability_level`, `lesson_v2_status`, `ll_type`, `lesson_entity_type`,
`evidence_kind`, `lesson_comment_kind`, `*_action_status`, `corporate_role`,
`member_role`, `organization_type` — are shared and must stay).

**Migration approach:** add the destructive `DROP TABLE ... CASCADE` /
`DROP TYPE` migration, then re-baseline Drizzle so `schema.ts` plus a single
squashed baseline migration is the new source of truth. The local dev DB applies
only the new drop migration; the squashed baseline is for fresh environments.

### C. Schema additions for the Notion-style lesson

Add to `lessons_v2`:

- `content jsonb` — the TipTap/ProseMirror document (nullable; default `null`).
- `description` stays `not null`; on save the server derives/refreshes it as a
  plain-text excerpt from `content` when `content` is present.

No other table changes. Attachments use the `attachments` table via the
`attachment` router, which is **rewritten** to support `entityType = 'lesson'`
only (it is currently hardcoded to legacy entities — see Architecture E).

### D. Notion-style Lesson page

New route: `app/(dashboard)/projects/[projectId]/lessons/[lessonId]/page.tsx`.
The cockpit list rows navigate here (replacing the side-drawer detail). Layout:

- **Header:** inline-editable title; status/type badges; workflow actions
  (submit / validate / decide) gated by `lesson-v2-rbac`; back link to cockpit.
- **Body (main column):** TipTap rich-text editor — headings, lists,
  bold/italic, links, task checkboxes. Autosaves `content` (debounced) through a
  new `lessonV2.updateLesson` mutation; server refreshes the `description`
  excerpt.
- **Properties (right rail):** inline-editable, autosaving fields — type, status,
  category, discipline, workstream, gate, project phase, author/owner, observed
  date, confidentiality, tags. Each writes through `lessonV2.updateLesson`.
- **Attachments section:** drag-drop + click upload via `attachment`
  router (Supabase Storage signed upload), file list with download/delete,
  scoped to this lesson.
- **Comments:** a new v2 thread on the `lesson_comments` table (currently
  unused), inline below the body. The old v1 thread + generic `comment` router
  are deleted.

### E. New / changed server procedures

- `lessonV2.getLesson(projectId, lessonId)` — full lesson incl. `content`,
  properties, attachment list, comment count (add if missing).
- `lessonV2.updateLesson(projectId, lessonId, patch)` — partial update of
  `content` + properties; refreshes `description` excerpt; writes
  `lesson_audit_log`; RBAC-gated (author/reviewer/lead per existing rules).
- `lessonV2.listComments` / `addComment` / `deleteComment` — new procedures on
  `lesson_comments` (the table exists but has no router today).
- `attachment` router rewritten: `entityType` enum reduced to `['lesson']`,
  project-id resolution via `lessons_v2`; upload/list/download/delete logic
  otherwise unchanged.

### F. Branding & docs

- Rebrand shell, login, metadata, and `README.md` to the Lessons Learned product
  (retain the existing `lel-it` naming already in the README).
- Remove interface process diagrams/screenshots from `docs/assets/readme`.
- Update sidebar/nav to point only at lessons + corporate surfaces; remove the
  module switcher and legacy feature flags.

## Data Flow

1. User opens a lesson from the cockpit → `/projects/[id]/lessons/[lessonId]`.
2. Page loads via `lessonV2.getLesson`; TipTap hydrates from `content`,
   properties panel from the lesson row, attachments from
   `attachment.listByEntity`, comments from the comments thread.
3. Edits (body or property) debounce → `lessonV2.updateLesson` → DB write +
   excerpt refresh + audit-log row → query invalidation.
4. File upload → `attachment.createUploadIntent` → client uploads to Supabase
   Storage → `attachment.completeUpload` → list refresh.
5. Workflow action → existing v2 mutations (submit/validate/decide).

## Error Handling

- **Autosave failures:** surface a non-blocking "unsaved / retry" indicator;
  keep local edits; retry on reconnect. Never silently drop body edits.
- **Upload failures:** per-file error state with retry; orphaned storage intents
  cleaned by existing `attachment` flow.
- **RBAC:** server rejects unauthorized edits; client hides controls the user
  can't use, but the server is the source of truth.
- **Migration safety:** drop migration is explicitly irreversible and documented;
  run only after the user confirms the legacy data is disposable.

## Testing

- Retain and keep green: `lesson-v2-workflow`, `lesson-v2-rbac`,
  `lesson-v2-transfer`.
- Delete tests for removed subsystems (`interface-compliance-rules`,
  `asset-anchor-catalog`, `lesson-visibility`, `lesson-workflow-rules`, v1
  `rbac`/`router-authz` portions referencing deleted routers).
- Add: `updateLesson` RBAC + excerpt-derivation unit test; `getLesson` shape
  test. Frontend editor verified manually via the run skill (autosave, upload,
  property edit).
- Gate completion on `pnpm --dir apps/web type-check` + retained test suite +
  `tsc` checks for `packages/db` and `packages/shared`.

## Risks

- **Enum/table coupling:** a legacy enum may be referenced by a retained table.
  Mitigation: verify each enum's references before dropping; drop tables before
  their enums; CASCADE carefully.
- **Migration history mismatch:** local DB has migrations outside Drizzle's
  journal. Mitigation: squashed baseline + a single forward drop migration;
  document `db:push` against a disposable DB for fresh setups.
- **Hidden legacy imports:** deleted routers may be imported by retained code.
  Mitigation: type-check after each removal batch; rely on TS to surface dangling
  references.

## Rollout

Single branch. Order: (1) delete legacy code + unregister routers, type-check
green; (2) schema additions (`content`) + drop migration + re-baseline; (3)
Notion-style lesson page + `getLesson`/`updateLesson`; (4) branding/docs.
Each stage independently type-checks and tests before the next.
