# Email-to-Lesson Inbox — Design Spec

**Date:** 2026-06-14
**Status:** Approved for planning
**Branch target:** new feature branch (isolated worktree)

## Summary

Let users capture a lesson by forwarding/CCing an email to a lel-it inbound
address. The email lands in the sender's **personal inbox** inside lel-it. From
the inbox the user assigns the item to a **project + category**, which creates a
**draft `lessons_v2`** record (carrying any email attachments). Slack and Teams
bots are an explicit future roadmap and are **out of scope** for this spec.

## Goals

- Forward/CC an email → it appears in the matching user's personal inbox.
- Assign an inbox item to a project + category → creates a draft lesson.
- Carry email file attachments onto the created lesson.
- Discard unwanted inbox items.

## Non-Goals (roadmap)

- Slack bot, Teams bot.
- Quoted-reply trimming (we store the full body for now).
- Sender acknowledgement / rejection emails.
- Bulk assign (assign multiple items at once).
- Per-user secret inbound addresses / verified-sender allowlists.

## Key Constraints Discovered

- `lessons_v2.project_id`, `lessons_v2.category_id`, `title`, `description`,
  `author_id` are all **NOT NULL**. An un-assigned email therefore **cannot** be
  a `lessons_v2` row — it needs a separate staging table.
- `attachments.project_id` is **NOT NULL**. Inbox attachments likewise need a
  separate staging table until assignment.
- Auth is Supabase `auth.users`; there is **no app-level users table** and
  `auth.users` is **not modeled in Drizzle**. Sender lookup uses raw SQL.
- Existing storage bucket is `attachments`; lesson attachment path convention is
  `projects/{projectId}/lesson/{entityId}/{attachmentId}/{file}`
  (`apps/web/src/server/routers/attachment.ts`).
- Size/type rules live in `apps/web/src/lib/attachments.ts`
  (`MAX_ATTACHMENT_BYTES` = 50 MB, `hasAllowedAttachmentType`).
- Service-role client: `createAdminClient()` in `apps/web/src/lib/supabase/admin.ts`.
- tRPC: `protectedProcedure` injects `ctx.user` (Supabase user);
  `apps/web/src/trpc/init.ts`.

## Architecture

### 1. Ingestion — Postmark inbound webhook

- MX for the inbound domain (e.g. `in.lel-it.app`) points at Postmark Inbound.
- Postmark POSTs parsed JSON to a Next.js **route handler**:
  `apps/web/src/app/api/inbound/email/[secret]/route.ts`.
- **Auth:** the `[secret]` path segment is compared (constant-time) against
  `INBOUND_EMAIL_SECRET`. Mismatch → `401`.
- **Sender match:** lowercase Postmark `From` looked up against `auth.users`
  via raw SQL (`select id from auth.users where lower(email) = lower($1)`).
  No match → log and return `200` (silently dropped; ack email is roadmap).
- **Dedupe:** Postmark `MessageID` is stored with a UNIQUE constraint. A repeat
  delivery (Postmark retry) is a no-op returning `200`.
- The handler always returns `2xx` for accepted/duplicate/unknown-sender so
  Postmark does not retry-storm. Only secret-mismatch and unexpected server
  errors return non-2xx.
- On a matched, new message the handler:
  1. Inserts an `inbox_items` row (`status = 'new'`).
  2. For each Postmark attachment that passes size + type checks, decodes the
     base64 `Content`, uploads to bucket `attachments` at
     `inbox/{inboxItemId}/{attachmentId}/{safeFileName}`, and inserts an
     `inbox_item_attachments` row. Files failing checks are skipped; the item is
     still created.

### 2. Data model (Drizzle, `packages/db/src/schema.ts`)

```text
inbox_items
  id            uuid pk default random
  user_id       uuid not null            -- matched auth.users.id (recipient/owner)
  message_id    text not null unique     -- Postmark MessageID (dedupe)
  from_email    text not null
  from_name     text
  subject       text not null default ''
  text_body     text not null default ''
  html_body     text
  status        inbox_item_status not null default 'new'  -- 'new'|'assigned'|'discarded'
  lesson_id     uuid                     -- set on assign (references lessons_v2, on delete set null)
  received_at   timestamptz not null
  created_at    timestamptz not null default now()
  indexes: (user_id, status, received_at), unique(message_id)

inbox_item_attachments
  id             uuid pk default random
  inbox_item_id  uuid not null references inbox_items(id) on delete cascade
  file_name      text not null
  mime_type      text not null
  size_bytes     integer not null
  storage_path   text not null
  created_at     timestamptz not null default now()
  index: (inbox_item_id)

enum inbox_item_status = ('new','assigned','discarded')
```

### 3. tRPC `inboxRouter` (`apps/web/src/server/routers/inbox.ts`)

All procedures are `protectedProcedure` and **always** scope by
`user_id = ctx.user.id` (personal inbox; no cross-user access).

- `list()` → items where `user_id = me AND status = 'new'`, newest first, each
  with attachment count. Also returns `count` for the nav badge.
- `get({ inboxItemId })` → one owned item plus its attachments. Not owned → `NOT_FOUND`.
- `assignToProject({ inboxItemId, projectId, categoryId, title?, type? })`:
  1. Load owned item with `status = 'new'`; else `NOT_FOUND`.
  2. `requireV2ProjectCapability(projectId, ctx.user.id, "create_lesson")`.
  3. `assertCategoryExists(categoryId)`.
  4. Insert `lessons_v2` draft: `title = title ?? item.subject` (fallback
     `"(no subject)"` if empty), `description = item.text_body` (fallback
     `"(no body)"`), `content` = TipTap doc built from `text_body`,
     `type = type ?? 'problem'`, `categoryId`, `authorId = ctx.user.id`,
     `projectId`, `status = 'draft'`.
  5. For each `inbox_item_attachments` row: `admin.storage.from('attachments')
     .copy(inboxPath, projectPath)` where projectPath =
     `projects/{projectId}/lesson/{lessonId}/{attachmentId}/{safeFileName}`,
     then insert an `attachments` row (`entityType='lesson'`,
     `entityId=lessonId`, `uploadedByUserId=ctx.user.id`).
  6. Update item: `status='assigned'`, `lesson_id = lessonId`.
  7. Audit via existing `audit(...)` helper (`eventType: 'created'`).
  8. Return `{ lessonId, projectId }`.
- `discard({ inboxItemId })` → owned `new` item → `status='discarded'`. Returns `{ ok: true }`.

Register `inbox: inboxRouter` in `apps/web/src/server/routers/_app.ts`.

### 4. UI

- **Nav:** add an **Inbox** entry in `apps/web/src/components/app-sidebar.tsx`
  with an unread badge driven by `inbox.list` count (reuse the badge style from
  `apps/web/src/components/lessons/lesson-badges.tsx`).
- **Page:** `apps/web/src/app/(dashboard)/inbox/page.tsx` — list of cards
  showing from name/email, subject, body snippet, received date, and attachment
  count. Per-row actions:
  - **Assign to project** → dialog: project `<select>` → category `<select>` →
    editable title (prefilled from subject) → confirm. On success, toast with a
    link to `/projects/{projectId}/lessons/{lessonId}` and the item leaves the list.
  - **Discard** → confirm → item leaves the list.
- Empty state when no `new` items.

### 5. Error handling

- Webhook: secret mismatch → 401; unknown sender / duplicate → 200 (logged);
  per-attachment failures are isolated (skip file, keep item, log).
- `assignToProject`: capability failure → `FORBIDDEN`; missing item/category →
  `NOT_FOUND`/`BAD_REQUEST`; a storage copy failure aborts the whole assign in a
  DB transaction so the item is not left half-converted (lesson insert + item
  update share one transaction; attachment copies happen before the item status
  flip, and a failure throws before commit).

### 6. Config / env

- `INBOUND_EMAIL_SECRET` — shared secret in the webhook URL path.
- Existing `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`.
- Document Postmark inbound setup + the webhook URL shape in the plan/README.

### 7. Testing

- Webhook handler: matched sender creates item; unknown sender → 200 + no row;
  bad secret → 401; duplicate `MessageID` → single row; attachment over size →
  skipped, item still created.
- `inboxRouter`: `list`/`get` enforce ownership; `assignToProject` creates a
  draft lesson, copies attachments, flips status, and enforces capability;
  `discard` flips status. Mirror existing Vitest patterns in
  `apps/web/src/server/__tests__/lesson-v2-*.test.ts`.

## Open Risks

- `auth.users` raw SQL coupling — acceptable; isolated in one helper.
- From-address spoofing — accepted for v1 (roadmap: verified-sender allowlist).
- Storage `.copy` across paths within one bucket — supported by Supabase Storage.
