# Offshore Wind Interface Tool - End of Phase 6 Code Review

Date: 2026-04-11  
Reviewer: Codex (static review + lint/type-check execution)

## 1) Scope Reviewed

- Repository scope: all tracked files (`git ls-files` = 126 files).
- Primary focus for SaaS readiness:
  - Multi-tenant access control / RBAC
  - Data model and migration integrity
  - API trust boundaries and query safety
  - Operational readiness (quality gates, tests, docs)
  - Product completeness for Interface Management workflows

## 2) Executive Summary

The codebase has a strong feature foundation for interface registers, agreements, points, IQ workflow, deliverables, 3D asset placement, and reporting.  
However, **it is not yet safe for production multi-tenant SaaS use**.

The highest risks are:
1. **Authorization gaps across many protected endpoints** (authenticated user can access/mutate other projects by ID).
2. **Schema/migration drift** (`schema.ts` defines tables not present in migration SQL).
3. **No test harness + failing lint baseline** (quality gate currently red).

These must be addressed before moving beyond controlled pilot usage.

## 3) Findings by Urgency and Timing

### P0 - Critical (Fix now, within 3-7 days)

| ID | Open Point | Evidence | Impact | When to Fix |
|---|---|---|---|---|
| P0-1 | Missing project membership/role checks on many read/write routers | `apps/web/src/server/routers/project.ts:21-111,121-158`, `agreement.ts:7-122`, `interface-point.ts:12-253`, `interface-query.ts:41-340`, `deliverable.ts:20-101`, `asset-placement.ts:27-125`, `activity.ts:8-81`, `report.ts:15-160`, `comment.ts:7-41`, `register.ts:67-83`, `work-package.ts:35-61` | Cross-project data leakage and unauthorized writes. Breaks tenant isolation. | Start immediately; complete in this sprint before Phase 7 kickoff. |
| P0-2 | `portfolio.createProject` does not validate portfolio ownership | `apps/web/src/server/routers/portfolio.ts:29-47` | Any authenticated user can create projects in another user's portfolio by `portfolioId`. | Same sprint as P0-1. |
| P0-3 | DB schema drift: `activities` + `member_work_packages` exist in schema but not in migration SQL | `packages/db/src/schema.ts:393-455` vs `packages/db/drizzle/0000_useful_cassandra_nova.sql:14-202` | New environments can boot with incomplete schema and runtime failures. | Same sprint; block production deployment until reconciled. |

### P1 - High (Fix in 1-2 weeks after P0)

| ID | Open Point | Evidence | Impact | When to Fix |
|---|---|---|---|---|
| P1-1 | Unsafe raw SQL composition pattern (`sql.raw` array construction) in member lookup | `apps/web/src/server/routers/project.ts:139-143` | Raises injection risk if future data assumptions change; hard to audit. | Week 2 post-P0. |
| P1-2 | Work package assignment not validated against project on add/update member | `apps/web/src/server/routers/project.ts:198-208,238-249` | Cross-project relation pollution possible by UUID misuse. | Week 2 post-P0. |
| P1-3 | Activity log endpoint accepts client-provided actor fields (`actorName`, `eventType`, etc.) | `apps/web/src/server/routers/activity.ts:26-70` | Audit feed integrity can be spoofed by clients. | Week 2 post-P0. |
| P1-4 | `DATABASE_URL` fallback silently defaults to local postgres | `packages/db/src/client.ts:5-7` | Misconfiguration risk in production/staging. | Week 2 post-P0. |

### P2 - Medium (Fix in 2-4 weeks)

| ID | Open Point | Evidence | Impact | When to Fix |
|---|---|---|---|---|
| P2-1 | Lint baseline failing with high `any` usage and unused code | `pnpm lint` output: 52 errors, 29 warnings (notably in project pages and routers) | Slower maintenance, weaker type guarantees, regressions harder to catch. | Weeks 3-4. |
| P2-2 | Type-check pipeline not runnable in current workspace state (`tsc` missing in packages) | `pnpm type-check` output (`tsc: command not found` in workspace packages) | CI reliability and local developer confidence reduced. | Weeks 3-4 (or immediately in CI hardening track). |
| P2-3 | Notification unread count loads full rowset then counts in memory | `apps/web/src/server/routers/notification.ts:15-26` | Inefficient at scale. | Weeks 3-4. |
| P2-4 | Static placeholder navigation/dashboard data still present | `apps/web/src/components/app-sidebar.tsx:29-147`, `apps/web/src/app/(dashboard)/page.tsx:46-103` | Product maturity gap for SaaS demo/production expectations. | Weeks 3-4. |
| P2-5 | No automated tests found (unit/integration/e2e) | Repository-wide (`git ls-files`) | High regression risk during rapid feature expansion. | Start in Weeks 3-4, continue in Phase 7. |

### P3 - Low / Continuous (Phase 7 onward)

| ID | Open Point | Evidence | Impact | When to Fix |
|---|---|---|---|---|
| P3-1 | General consistency cleanup (unused imports, docs refresh from template README) | `apps/web/README.md`, various eslint warnings | Reduces noise, improves onboarding. | Continuous in Phase 7. |
| P3-2 | UX polish and domain workflow enhancements (non-blocking) | Multiple dashboard and reporting pages | Improves market differentiation but not a security blocker. | Phase 7 product iteration. |

## 4) Recommended Remediation Plan from End of Phase 6

### Phase 6.1 (Immediate hardening, 1 sprint)
1. Introduce a single `requireProjectAccess(projectId, minRole)` guard and apply it to every router procedure that touches project-derived entities.
2. Enforce ownership in `portfolio.createProject`.
3. Add project-scoped validation for all foreign IDs in mutations (`registerId`, `agreementId`, `pointId`, `workPackageId`, etc.).
4. Regenerate migrations from current schema and validate clean bootstrap (`supabase db reset` / fresh DB).

### Phase 6.2 (Stabilization, 1 sprint)
1. Replace raw SQL construction with parameterized query patterns.
2. Lock `activity.log` to server-derived actor identity and allowed event whitelist.
3. Remove production DB fallback defaults; fail fast on missing env.
4. Bring lint to green for server/router layer first, then high-traffic pages.

### Phase 6.3 (Quality Gate foundation, ongoing into Phase 7)
1. Add minimal automated tests:
   - Router authz tests (critical)
   - Schema migration consistency check
   - Smoke flows: register -> agreement -> point -> IQ -> response -> report
2. Enforce CI gates (`lint`, `type-check`, targeted test suite) before merge.

## 5) Suggested “Definition of Done” Before Broad SaaS Rollout

- No cross-project read/write possible without membership.
- All router mutations enforce role requirements server-side.
- Fresh environment migration succeeds with full schema parity.
- CI green on lint + type-check + critical authz/integration tests.
- Placeholder demo data removed from navigation/dashboard.

## 6) Command Evidence Executed During Review

- `git ls-files`
- `pnpm lint` (failed: 52 errors, 29 warnings)
- `pnpm type-check` (failed in workspace packages due missing `tsc` runtime in current install state)
- Multiple static inspections of all tracked app/package/db/supabase config files.

