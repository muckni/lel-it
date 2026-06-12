# OWIT - Offshore Wind Lessons Tool

OWIT is a lessons learned governance tool for offshore wind projects. It helps project teams capture execution lessons while work is happening, validate them through a controlled workflow, convert them into project actions, and promote reusable recommendations into a corporate library.

The current product focus is the Lessons v2 workflow:

- Project lessons cockpit for capture, review queues, clusters, recommended actions, and implementation actions.
- Corporate library for reusable recommended actions.
- Corporate proposal review for promoting project recommendations.
- Corporate dashboard for library coverage, proposal backlog, reuse, and implementation visibility.
- Role-aware access that lets all users browse corporate guidance while limiting source project visibility to senior management and LL management.

## Tech Stack

- TypeScript, React 19, Next.js 16
- tRPC v11 and TanStack Query
- Drizzle ORM with PostgreSQL / Supabase local Postgres
- Tailwind CSS v4 and shadcn-style UI primitives
- Vitest for focused workflow tests
- pnpm workspaces

## Workspace

```text
apps/web        Next.js application
packages/db     Drizzle schema, migrations, seed data
packages/shared Shared enums/types
packages/3d     3D package retained for domain compatibility
docs            Product and implementation plans
```

## Local Setup

Install dependencies:

```bash
pnpm install
```

Start local Supabase/Postgres if it is not already running, then apply migrations:

```bash
pnpm --filter @owit/db db:migrate
```

For the local database used in this workspace, older migrations may already exist outside Drizzle's migration journal. If full replay collides with existing objects, apply only missing migration files or use `db:push` against a disposable local database.

Run the web app:

```bash
pnpm --dir apps/web dev
```

Open:

- Project lessons: `/projects/<project-id>/lessons-v2`
- Corporate library: `/corporate/library`
- Corporate proposals: `/corporate/proposals`
- Corporate dashboard: `/corporate/dashboard`

## Demo Data

Seed the newest active local project with a rich Lessons v2 data set:

```bash
pnpm --filter @owit/db seed:lessons-v2-demo
```

The seed is idempotent by title/source checks. It creates:

- 47 project lessons across engineering, procurement, construction, installation, commissioning, HSE, commercial, quality, and project management.
- Workstreams and gate references for the selected project.
- Approved clusters for recurring themes.
- Project recommended actions.
- Corporate proposals and published corporate recommended actions.
- Project implementation actions and assignments.
- A corporate LL manager role for the local dev user.

The seed targets the newest active project in the local database. Create or activate the intended project before running it if needed.

## Core Workflows

Project workflow:

1. Capture a lesson as draft or submit immediately.
2. Review submitted lessons and validate the useful ones.
3. Cluster validated lessons into recurring themes.
4. Create recommended actions from validated lessons or approved clusters.
5. Approve project actions and optionally propose reusable guidance for corporate review.
6. Add corporate recommended actions back into project implementation.

Corporate workflow:

1. Browse reusable guidance in the corporate library.
2. Review project proposals in the corporate proposals page.
3. Publish approved proposals into the corporate library.
4. Monitor reuse and implementation through the corporate dashboard.

## Verification

Useful checks:

```bash
pnpm --dir apps/web type-check
pnpm --dir apps/web test src/server/__tests__/lesson-v2-workflow.test.ts src/server/__tests__/lesson-v2-rbac.test.ts src/server/__tests__/lesson-v2-transfer.test.ts
apps/web/node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types
apps/web/node_modules/.bin/tsc -p packages/shared/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types
```

## Access Model

Project access derives from existing project membership and optional Lessons v2 project memberships.

Corporate access uses `user_corporate_roles`:

- `corporate_viewer`: browse corporate library.
- `corporate_ll_manager`: review/publish corporate proposals and view source project names.
- `senior_management`: corporate visibility and source project names.
- `corporate_admin`: platform administration.

Source project visibility is deliberately restricted to senior management and LL management.

## Notes

- Legacy interface-management UI routes have been removed from the web app. Backend/domain tables are retained where existing data or historical references still depend on them.
- Corporate library browsing is available broadly; proposal publishing and source project visibility remain role-gated.
- The local demo seed is for development and presentation data only.
