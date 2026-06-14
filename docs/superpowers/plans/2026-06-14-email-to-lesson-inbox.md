# Email-to-Lesson Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users forward/CC an email to a lel-it address so it lands in their personal inbox, then assign it to a project + category to create a draft lesson (carrying attachments).

**Architecture:** A Postmark inbound webhook (Next.js route handler) matches the sender to a Supabase `auth.users` id and stages the email in new `inbox_items` / `inbox_item_attachments` tables (neither tied to a project). A personal-scoped tRPC `inboxRouter` lists items and converts one into a draft `lessons_v2` row, copying staged attachments into the project's storage path. A new `/inbox` page and sidebar entry drive the UI.

**Tech Stack:** Next.js 16 (App Router route handlers), tRPC v11, Drizzle ORM + Supabase Postgres, Supabase Storage (`attachments` bucket), Vitest, Tailwind v4 / shadcn-style UI.

**Spec:** `docs/superpowers/specs/2026-06-14-email-to-lesson-inbox-design.md`

---

## File Structure

- Create `packages/db/src/schema.ts` additions: `inboxItemStatusEnum`, `inboxItems`, `inboxItemAttachments` tables + relations.
- Create migration via `pnpm --filter @owit/db db:generate` (Drizzle emits SQL under `packages/db/drizzle/`).
- Create `apps/web/src/server/lib/inbound-email.ts` — pure parsing/validation/filter/secret helpers.
- Create `apps/web/src/server/lib/inbox-content.ts` — `textToTiptapDoc` pure helper.
- Create `apps/web/src/server/lib/__tests__/inbound-email.test.ts` and `apps/web/src/server/lib/__tests__/inbox-content.test.ts`.
- Create `apps/web/src/server/lib/user-lookup.ts` — `findUserIdByEmail` (raw SQL on `auth.users`).
- Create `apps/web/src/app/api/inbound/email/[secret]/route.ts` — Postmark webhook handler.
- Create `apps/web/src/server/routers/inbox.ts` — `inboxRouter`.
- Modify `apps/web/src/server/routers/_app.ts` — register `inbox`.
- Create `apps/web/src/app/(dashboard)/inbox/page.tsx` + `apps/web/src/components/inbox/` components.
- Modify `apps/web/src/components/app-sidebar.tsx` — Inbox nav entry + badge.
- Modify `README.md` — Postmark setup + env vars.

---

## Task 1: Database schema for inbox staging tables

**Files:**
- Modify: `packages/db/src/schema.ts`
- Generate: `packages/db/drizzle/<NNNN>_*.sql` (via drizzle-kit)

- [ ] **Step 1: Add the enum and tables to the schema**

In `packages/db/src/schema.ts`, add the enum near the other `pgEnum` declarations (after `attachmentEntityEnum` around line 36):

```ts
export const inboxItemStatusEnum = pgEnum("inbox_item_status", [
  "new",
  "assigned",
  "discarded",
]);
```

Add these two tables after the `attachments` table (after line 389). They intentionally have **no** `projectId` — an inbox item exists before it is assigned to a project:

```ts
export const inboxItems = pgTable(
  "inbox_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(), // references Supabase auth.users
    messageId: text("message_id").notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name"),
    subject: text("subject").notNull().default(""),
    textBody: text("text_body").notNull().default(""),
    htmlBody: text("html_body"),
    status: inboxItemStatusEnum("status").notNull().default("new"),
    lessonId: uuid("lesson_id").references(() => lessonsV2.id, {
      onDelete: "set null",
    }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("inbox_items_message_id_idx").on(table.messageId),
    index("inbox_items_user_status_idx").on(
      table.userId,
      table.status,
      table.receivedAt
    ),
  ]
);

export const inboxItemAttachments = pgTable(
  "inbox_item_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inboxItemId: uuid("inbox_item_id")
      .notNull()
      .references(() => inboxItems.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inbox_item_attachments_item_idx").on(table.inboxItemId),
  ]
);
```

Add relations after the existing relations block for attachments/lessons:

```ts
export const inboxItemsRelations = relations(inboxItems, ({ many }) => ({
  attachments: many(inboxItemAttachments),
}));

export const inboxItemAttachmentsRelations = relations(
  inboxItemAttachments,
  ({ one }) => ({
    inboxItem: one(inboxItems, {
      fields: [inboxItemAttachments.inboxItemId],
      references: [inboxItems.id],
    }),
  })
);
```

> Note: `pgEnum`, `pgTable`, `uuid`, `text`, `timestamp`, `integer`, `index`, `uniqueIndex`, and `relations` are already imported at the top of `schema.ts`. Do not add duplicate imports.

- [ ] **Step 2: Verify the schema type-checks**

Run: `apps/web/node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types`
Expected: PASS (no errors).

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @owit/db db:generate`
Expected: a new file `packages/db/drizzle/<NNNN>_*.sql` containing `CREATE TYPE ... inbox_item_status`, `CREATE TABLE ... inbox_items`, `CREATE TABLE ... inbox_item_attachments`. Review the SQL to confirm it only adds these objects.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle
git commit -m "feat(db): inbox staging tables for email-to-lesson"
```

---

## Task 2: Pure helper — `textToTiptapDoc`

**Files:**
- Create: `apps/web/src/server/lib/inbox-content.ts`
- Test: `apps/web/src/server/lib/__tests__/inbox-content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/lib/__tests__/inbox-content.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { textToTiptapDoc } from "../inbox-content";

describe("textToTiptapDoc", () => {
  it("wraps each line in a paragraph", () => {
    const doc = textToTiptapDoc("line one\nline two");
    expect(doc).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "line one" }] },
        { type: "paragraph", content: [{ type: "text", text: "line two" }] },
      ],
    });
  });

  it("renders blank lines as empty paragraphs", () => {
    const doc = textToTiptapDoc("a\n\nb");
    expect(doc.content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "a" }] },
      { type: "paragraph" },
      { type: "paragraph", content: [{ type: "text", text: "b" }] },
    ]);
  });

  it("returns a single empty paragraph for empty input", () => {
    expect(textToTiptapDoc("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/server/lib/__tests__/inbox-content.test.ts`
Expected: FAIL with "Cannot find module '../inbox-content'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/server/lib/inbox-content.ts`:

```ts
export type TiptapDoc = {
  type: "doc";
  content: Array<{
    type: "paragraph";
    content?: Array<{ type: "text"; text: string }>;
  }>;
};

/**
 * Convert plain text (e.g. an email body) into a minimal TipTap document,
 * one paragraph per line. Blank lines become empty paragraphs.
 */
export function textToTiptapDoc(text: string): TiptapDoc {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] };
  }

  const content = normalized.split("\n").map((line) =>
    line.length === 0
      ? { type: "paragraph" as const }
      : { type: "paragraph" as const, content: [{ type: "text" as const, text: line }] }
  );

  return { type: "doc", content };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/server/lib/__tests__/inbox-content.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/lib/inbox-content.ts apps/web/src/server/lib/__tests__/inbox-content.test.ts
git commit -m "feat: textToTiptapDoc helper for email bodies"
```

---

## Task 3: Pure helpers — parse, filter, secret-compare

**Files:**
- Create: `apps/web/src/server/lib/inbound-email.ts`
- Test: `apps/web/src/server/lib/__tests__/inbound-email.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/server/lib/__tests__/inbound-email.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  parseInboundEmail,
  filterInboundAttachments,
  secretMatches,
} from "../inbound-email";

const base = {
  FromFull: { Email: "User@Corp.com", Name: "User Name" },
  Subject: "Cable pull issue",
  TextBody: "We learned something.",
  HtmlBody: "<p>We learned something.</p>",
  MessageID: "msg-123",
  Date: "Sat, 14 Jun 2026 10:00:00 +0000",
  Attachments: [],
};

describe("parseInboundEmail", () => {
  it("normalizes a valid Postmark payload", () => {
    const result = parseInboundEmail(base);
    expect(result).toEqual({
      messageId: "msg-123",
      fromEmail: "user@corp.com",
      fromName: "User Name",
      subject: "Cable pull issue",
      textBody: "We learned something.",
      htmlBody: "<p>We learned something.</p>",
      receivedAt: new Date("Sat, 14 Jun 2026 10:00:00 +0000"),
      attachments: [],
    });
  });

  it("defaults subject/body and falls back to now for a bad date", () => {
    const result = parseInboundEmail({
      FromFull: { Email: "a@b.com" },
      MessageID: "m1",
      Date: "not-a-date",
    });
    expect(result.subject).toBe("");
    expect(result.textBody).toBe("");
    expect(result.fromName).toBeNull();
    expect(Number.isNaN(result.receivedAt.getTime())).toBe(false);
  });

  it("throws when required fields are missing", () => {
    expect(() => parseInboundEmail({ Subject: "x" })).toThrow();
  });
});

describe("filterInboundAttachments", () => {
  it("accepts allowed types within the size limit and skips others", () => {
    const { accepted, skipped } = filterInboundAttachments([
      { Name: "plan.pdf", ContentType: "application/pdf", ContentLength: 1000, Content: "AAAA" },
      { Name: "virus.exe", ContentType: "application/octet-stream", ContentLength: 10, Content: "AA" },
      { Name: "huge.png", ContentType: "image/png", ContentLength: 60 * 1024 * 1024, Content: "AA" },
    ]);
    expect(accepted.map((a) => a.Name)).toEqual(["plan.pdf"]);
    expect(skipped.map((a) => a.Name)).toEqual(["virus.exe", "huge.png"]);
  });
});

describe("secretMatches", () => {
  it("matches identical secrets and rejects others", () => {
    expect(secretMatches("abc", "abc")).toBe(true);
    expect(secretMatches("abc", "abd")).toBe(false);
    expect(secretMatches("abc", "")).toBe(false);
    expect(secretMatches("", "abc")).toBe(false);
    expect(secretMatches("abc", undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/server/lib/__tests__/inbound-email.test.ts`
Expected: FAIL with "Cannot find module '../inbound-email'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/server/lib/inbound-email.ts`:

```ts
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import {
  MAX_ATTACHMENT_BYTES,
  hasAllowedAttachmentType,
} from "@/lib/attachments";

const postmarkAttachmentSchema = z.object({
  Name: z.string(),
  Content: z.string(), // base64
  ContentType: z.string().optional().default(""),
  ContentLength: z.number().int().nonnegative().optional().default(0),
});

export type PostmarkAttachment = z.infer<typeof postmarkAttachmentSchema>;

const postmarkInboundSchema = z.object({
  FromFull: z.object({
    Email: z.string().min(1),
    Name: z.string().optional(),
  }),
  MessageID: z.string().min(1),
  Subject: z.string().optional().default(""),
  TextBody: z.string().optional().default(""),
  HtmlBody: z.string().optional().default(""),
  Date: z.string().optional(),
  Attachments: z.array(postmarkAttachmentSchema).optional().default([]),
});

export type InboundEmail = {
  messageId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  textBody: string;
  htmlBody: string;
  receivedAt: Date;
  attachments: PostmarkAttachment[];
};

/** Parse and normalize a Postmark inbound payload. Throws on invalid input. */
export function parseInboundEmail(payload: unknown): InboundEmail {
  const p = postmarkInboundSchema.parse(payload);
  const parsedDate = p.Date ? new Date(p.Date) : new Date();
  const receivedAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  return {
    messageId: p.MessageID,
    fromEmail: p.FromFull.Email.trim().toLowerCase(),
    fromName: p.FromFull.Name?.trim() ? p.FromFull.Name.trim() : null,
    subject: p.Subject,
    textBody: p.TextBody,
    htmlBody: p.HtmlBody,
    receivedAt,
    attachments: p.Attachments,
  };
}

/** Split attachments into accepted (allowed type + within size limit) and skipped. */
export function filterInboundAttachments(attachments: PostmarkAttachment[]): {
  accepted: PostmarkAttachment[];
  skipped: PostmarkAttachment[];
} {
  const accepted: PostmarkAttachment[] = [];
  const skipped: PostmarkAttachment[] = [];
  for (const att of attachments) {
    const okSize = att.ContentLength <= MAX_ATTACHMENT_BYTES;
    const okType = hasAllowedAttachmentType({ name: att.Name, type: att.ContentType });
    if (okSize && okType) {
      accepted.push(att);
    } else {
      skipped.push(att);
    }
  }
  return { accepted, skipped };
}

/** Constant-time comparison of a provided secret against the configured one. */
export function secretMatches(provided: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/server/lib/__tests__/inbound-email.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/lib/inbound-email.ts apps/web/src/server/lib/__tests__/inbound-email.test.ts
git commit -m "feat: pure inbound-email parse/filter/secret helpers"
```

---

## Task 4: Sender lookup against `auth.users`

**Files:**
- Create: `apps/web/src/server/lib/user-lookup.ts`

> No unit test: this requires a live `auth.users` table and the repo has no DB-integration test harness. Verification is type-check; behavior is covered by the manual webhook check in Task 9.

- [ ] **Step 1: Write the implementation**

Create `apps/web/src/server/lib/user-lookup.ts`:

```ts
import { sql } from "drizzle-orm";
import { db } from "@owit/db";

/**
 * Look up a Supabase auth user id by email (case-insensitive).
 * `auth.users` is not modeled in Drizzle, so this uses raw SQL.
 * Returns null when no user matches.
 */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const rows = (await db.execute(
    sql`select id from auth.users where lower(email) = ${normalized} limit 1`
  )) as unknown as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/server/lib/user-lookup.ts
git commit -m "feat: findUserIdByEmail lookup against auth.users"
```

---

## Task 5: Postmark inbound webhook route handler

**Files:**
- Create: `apps/web/src/app/api/inbound/email/[secret]/route.ts`

> No unit test (Next route handler + DB + storage). Verified by type-check here and the manual check in Task 9.

- [ ] **Step 1: Write the implementation**

Create `apps/web/src/app/api/inbound/email/[secret]/route.ts`:

```ts
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db, inboxItems, inboxItemAttachments } from "@owit/db";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseInboundEmail,
  filterInboundAttachments,
  secretMatches,
} from "@/server/lib/inbound-email";
import { findUserIdByEmail } from "@/server/lib/user-lookup";

const BUCKET = "attachments";

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ secret: string }> }
) {
  const { secret } = await params;
  if (!secretMatches(secret, process.env.INBOUND_EMAIL_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let email;
  try {
    const payload = await req.json();
    email = parseInboundEmail(payload);
  } catch {
    // Malformed payload: ack so Postmark stops retrying, but record nothing.
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const userId = await findUserIdByEmail(email.fromEmail);
  if (!userId) {
    console.warn(`[inbound-email] no user for sender ${email.fromEmail}`);
    return NextResponse.json({ status: "unknown-sender" }, { status: 200 });
  }

  // Dedupe on Postmark MessageID (unique index). onConflictDoNothing -> no row returned.
  const [item] = await db
    .insert(inboxItems)
    .values({
      userId,
      messageId: email.messageId,
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      subject: email.subject,
      textBody: email.textBody,
      htmlBody: email.htmlBody,
      receivedAt: email.receivedAt,
    })
    .onConflictDoNothing({ target: inboxItems.messageId })
    .returning();

  if (!item) {
    return NextResponse.json({ status: "duplicate" }, { status: 200 });
  }

  const { accepted } = filterInboundAttachments(email.attachments);
  if (accepted.length > 0) {
    const admin = createAdminClient();
    for (const att of accepted) {
      try {
        const attachmentId = randomUUID();
        const safeName = sanitizeFileName(att.Name);
        const storagePath = `inbox/${item.id}/${attachmentId}/${safeName}`;
        const bytes = Buffer.from(att.Content, "base64");
        const { error } = await admin.storage
          .from(BUCKET)
          .upload(storagePath, bytes, { contentType: att.ContentType || undefined });
        if (error) {
          console.error(`[inbound-email] upload failed for ${att.Name}: ${error.message}`);
          continue;
        }
        await db.insert(inboxItemAttachments).values({
          inboxItemId: item.id,
          fileName: safeName,
          mimeType: att.ContentType || "application/octet-stream",
          sizeBytes: bytes.length,
          storagePath,
        });
      } catch (err) {
        console.error(`[inbound-email] attachment error for ${att.Name}:`, err);
      }
    }
  }

  return NextResponse.json({ status: "captured", inboxItemId: item.id }, { status: 200 });
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/api/inbound/email
git commit -m "feat: Postmark inbound email webhook handler"
```

---

## Task 6: `inboxRouter` — list, get, discard + registration

**Files:**
- Create: `apps/web/src/server/routers/inbox.ts`
- Modify: `apps/web/src/server/routers/_app.ts`

> `assignToProject` is added in Task 7. This task builds the read/discard surface and wires the router in.

- [ ] **Step 1: Write the router (list/get/discard)**

Create `apps/web/src/server/routers/inbox.ts`:

```ts
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, inboxItems, inboxItemAttachments } from "@owit/db";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

async function getOwnedItem(inboxItemId: string, userId: string) {
  const item = await db.query.inboxItems.findFirst({
    where: and(eq(inboxItems.id, inboxItemId), eq(inboxItems.userId, userId)),
    with: { attachments: true },
  });
  if (!item) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Inbox item not found" });
  }
  return item;
}

export const inboxRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await db.query.inboxItems.findMany({
      where: and(
        eq(inboxItems.userId, ctx.user.id),
        eq(inboxItems.status, "new")
      ),
      orderBy: [desc(inboxItems.receivedAt)],
      with: { attachments: { columns: { id: true } } },
    });

    return {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        fromEmail: item.fromEmail,
        fromName: item.fromName,
        subject: item.subject,
        snippet: item.textBody.replace(/\s+/g, " ").trim().slice(0, 200),
        receivedAt: item.receivedAt,
        attachmentCount: item.attachments.length,
      })),
    };
  }),

  get: protectedProcedure
    .input(z.object({ inboxItemId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const item = await getOwnedItem(input.inboxItemId, ctx.user.id);
      return {
        id: item.id,
        status: item.status,
        fromEmail: item.fromEmail,
        fromName: item.fromName,
        subject: item.subject,
        textBody: item.textBody,
        receivedAt: item.receivedAt,
        lessonId: item.lessonId,
        attachments: item.attachments.map((a) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
        })),
      };
    }),

  discard: protectedProcedure
    .input(z.object({ inboxItemId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const item = await getOwnedItem(input.inboxItemId, ctx.user.id);
      if (item.status !== "new") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only new inbox items can be discarded",
        });
      }
      await db
        .update(inboxItems)
        .set({ status: "discarded" })
        .where(eq(inboxItems.id, item.id));
      return { ok: true as const };
    }),
});
```

> `inboxItemAttachments` is imported now because Task 7 will use it; if your linter flags it as unused at this step, add the import together with Task 7's edit instead.

- [ ] **Step 2: Register the router**

In `apps/web/src/server/routers/_app.ts`, add the import and the router entry:

```ts
import { inboxRouter } from "./inbox";
```

and inside `createTRPCRouter({ ... })` add:

```ts
  inbox: inboxRouter,
```

- [ ] **Step 3: Verify it type-checks**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/server/routers/inbox.ts apps/web/src/server/routers/_app.ts
git commit -m "feat: inboxRouter list/get/discard"
```

---

## Task 7: `inboxRouter.assignToProject` — convert to draft lesson

**Files:**
- Modify: `apps/web/src/server/routers/inbox.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/web/src/server/routers/inbox.ts`, extend the imports:

```ts
import { randomUUID } from "crypto";
```

Add to the existing `@owit/db` import: `lessonsV2`, `lessonCategories`, `lessonAuditLog`. Add these new imports:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { requireV2ProjectCapability } from "@/server/lib/lesson-v2-rbac";
import { buildLessonV2AuditEvent } from "@/server/lib/lesson-v2-transfer";
import { textToTiptapDoc } from "@/server/lib/inbox-content";
import { LESSON_TYPES } from "@owit/shared";
```

Add a local sanitizer + category check helper above `export const inboxRouter`:

```ts
const BUCKET = "attachments";

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/[^\w.\-() ]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

async function assertCategoryExists(categoryId: string) {
  const category = await db.query.lessonCategories.findFirst({
    where: and(eq(lessonCategories.id, categoryId), eq(lessonCategories.active, true)),
    columns: { id: true },
  });
  if (!category) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Category does not exist" });
  }
}
```

- [ ] **Step 2: Add the `assignToProject` procedure**

Inside `createTRPCRouter({ ... })`, add after `discard`:

```ts
  assignToProject: protectedProcedure
    .input(
      z.object({
        inboxItemId: z.string().uuid(),
        projectId: z.string().uuid(),
        categoryId: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        type: z.enum(LESSON_TYPES).default("problem"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const item = await getOwnedItem(input.inboxItemId, ctx.user.id);
      if (item.status !== "new") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Inbox item already handled",
        });
      }
      await requireV2ProjectCapability(input.projectId, ctx.user.id, "create_lesson");
      await assertCategoryExists(input.categoryId);

      const lessonId = randomUUID();
      const title = input.title ?? (item.subject.trim() || "(no subject)");
      const description = item.textBody.trim() || "(no body)";
      const content = textToTiptapDoc(item.textBody);

      // Copy staged attachments into the project's lesson path first; a failure
      // here throws before any DB write so the item is never half-converted.
      const admin = createAdminClient();
      const attachmentRows: Array<typeof import("@owit/db").attachments.$inferInsert> = [];
      for (const att of item.attachments) {
        const attachmentId = randomUUID();
        const safeName = sanitizeFileName(att.fileName);
        const destPath = `projects/${input.projectId}/lesson/${lessonId}/${attachmentId}/${safeName}`;
        const { error } = await admin.storage
          .from(BUCKET)
          .copy(att.storagePath, destPath);
        if (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to copy attachment ${att.fileName}: ${error.message}`,
          });
        }
        attachmentRows.push({
          projectId: input.projectId,
          entityType: "lesson",
          entityId: lessonId,
          fileName: safeName,
          storagePath: destPath,
          mimeType: att.mimeType,
          sizeBytes: att.sizeBytes,
          uploadedByUserId: ctx.user.id,
        });
      }

      await db.transaction(async (tx) => {
        await tx.insert(lessonsV2).values({
          id: lessonId,
          projectId: input.projectId,
          title,
          description,
          content,
          type: input.type,
          categoryId: input.categoryId,
          authorId: ctx.user.id,
          status: "draft",
        });
        if (attachmentRows.length > 0) {
          await tx.insert(attachments).values(attachmentRows);
        }
        await tx
          .update(inboxItems)
          .set({ status: "assigned", lessonId })
          .where(eq(inboxItems.id, item.id));
        await tx.insert(lessonAuditLog).values(
          buildLessonV2AuditEvent({
            entityType: "lesson",
            entityId: lessonId,
            eventType: "created",
            actorId: ctx.user.id,
            projectId: input.projectId,
            newValue: { source: "inbox", inboxItemId: item.id },
          }) as typeof lessonAuditLog.$inferInsert
        );
      });

      return { lessonId, projectId: input.projectId };
    }),
```

> Add `attachments` to the `@owit/db` import list (used in the transaction and the typed rows array).

- [ ] **Step 3: Verify it type-checks**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

> If the `import("@owit/db").attachments.$inferInsert` inline type is awkward for the linter, replace the `attachmentRows` declaration with `const attachmentRows: (typeof attachments.$inferInsert)[] = [];` using the imported `attachments` table.

- [ ] **Step 4: Verify existing lesson tests still pass**

Run: `pnpm --dir apps/web test src/server/lib/__tests__/inbound-email.test.ts src/server/lib/__tests__/inbox-content.test.ts`
Expected: PASS (all from Tasks 2-3 still green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/routers/inbox.ts
git commit -m "feat: inbox assignToProject creates draft lesson with attachments"
```

---

## Task 8: Inbox UI — page, list, assign dialog

**Files:**
- Create: `apps/web/src/app/(dashboard)/inbox/page.tsx`
- Create: `apps/web/src/components/inbox/inbox-list.tsx`
- Create: `apps/web/src/components/inbox/assign-to-project-dialog.tsx`

> Match the existing client-component patterns in `apps/web/src/app/(dashboard)/projects/[projectId]/lessons/page.tsx` (tRPC client hooks, toast usage, shadcn primitives). Before writing, open that file and the corporate library page to copy the exact import paths for the tRPC client, `Button`, `Dialog`, `Select`, and toast helper used in this repo.

- [ ] **Step 1: Build the assign dialog**

Create `apps/web/src/components/inbox/assign-to-project-dialog.tsx`. It receives `inboxItemId`, `defaultTitle`, and an `onAssigned` callback. It:
- queries the user's projects (reuse the same query the lessons/sidebar UI uses — inspect `app-sidebar.tsx` / `portfolio` router for the existing "my projects" query) into a project `<Select>`;
- on project change, queries that project's active categories (find the existing category query used by the project lessons create form; if none exists, add a `categories` query to `lessonV2Router` mirroring `assertCategoryExists`/`lessonCategories` and use it) into a category `<Select>`;
- shows an editable title input prefilled with `defaultTitle`;
- calls `trpc.inbox.assignToProject.useMutation`; on success calls `onAssigned(result)` and shows a success toast linking to `/projects/{projectId}/lessons/{lessonId}`.

Use the repo's existing `Dialog`, `Select`, `Input`, `Button`, and toast components (same imports as the lessons pages). Disable the confirm button until both project and category are selected.

- [ ] **Step 2: Build the inbox list**

Create `apps/web/src/components/inbox/inbox-list.tsx` (client component):
- `const { data, refetch } = trpc.inbox.list.useQuery();`
- render a card per item: from name/email, subject (bold), snippet, formatted `receivedAt`, and an attachment count chip when `attachmentCount > 0`;
- each card has an **Assign to project** button (opens `AssignToProjectDialog` with `defaultTitle = subject`) and a **Discard** button (`trpc.inbox.discard.useMutation`, confirm via `window.confirm`, then `refetch()`);
- on assign success, call `refetch()` so the item leaves the list;
- empty state: "Your inbox is empty. Forward an email to capture a lesson." when `data?.items.length === 0`.

- [ ] **Step 3: Build the page**

Create `apps/web/src/app/(dashboard)/inbox/page.tsx`:

```tsx
import { InboxList } from "@/components/inbox/inbox-list";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="text-muted-foreground text-sm">
          Emails you forwarded, ready to file as lessons.
        </p>
      </header>
      <InboxList />
    </div>
  );
}
```

> If `inbox-list.tsx` or the dialog needs to be a client component, add `"use client";` as the first line (match how the lessons pages declare client components).

- [ ] **Step 4: Verify it type-checks and builds**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(dashboard)/inbox apps/web/src/components/inbox
git commit -m "feat: inbox page with assign-to-project and discard"
```

---

## Task 9: Sidebar nav entry + unread badge

**Files:**
- Modify: `apps/web/src/components/app-sidebar.tsx`
- Reference: `apps/web/src/components/lessons/lesson-badges.tsx`

- [ ] **Step 1: Add the Inbox nav item with badge**

In `apps/web/src/components/app-sidebar.tsx`, add an **Inbox** `SidebarMenuButton` linking to `/inbox`, placed near the top-level nav entries (alongside the existing `/` and `corporate/*` links around lines 79-106). Drive an unread badge from `trpc.inbox.list.useQuery()` showing `data?.count` when `> 0`, styled to match the badge in `lesson-badges.tsx`.

Use the same `SidebarMenuButton` + `render={<a href="/inbox" />}` pattern already used for the other links in this file. If the sidebar is a server component, factor the badge into a small `"use client"` child component that calls the tRPC hook (mirror how other dynamic counts are rendered in this repo; check whether `app-sidebar.tsx` is already a client component first).

- [ ] **Step 2: Verify it type-checks**

Run: `pnpm --dir apps/web type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/app-sidebar.tsx
git commit -m "feat: Inbox sidebar entry with unread badge"
```

---

## Task 10: Docs — Postmark setup, env, manual verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the feature**

Add a section to `README.md` (after "Local Setup") titled **Email-to-Lesson Inbox** covering:
- Required env var `INBOUND_EMAIL_SECRET` (used in the webhook path) and the existing `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL`.
- Webhook URL shape: `https://<host>/api/inbound/email/<INBOUND_EMAIL_SECRET>`.
- Postmark inbound setup: point the server's inbound webhook at that URL; set MX for the inbound domain to Postmark per Postmark docs.
- Behavior: only emails whose `From` matches a registered `auth.users` email are captured; others are dropped. Items appear under `/inbox`.
- Roadmap note: Slack and Teams bots will offer the same "tag → capture" flow.

- [ ] **Step 2: Run the full verification suite**

Run:
```bash
pnpm --dir apps/web type-check
pnpm --dir apps/web test src/server/lib/__tests__/inbox-content.test.ts src/server/lib/__tests__/inbound-email.test.ts
apps/web/node_modules/.bin/tsc -p packages/db/tsconfig.json --noEmit --typeRoots apps/web/node_modules/@types
```
Expected: all PASS.

- [ ] **Step 3: Manual smoke test (optional, requires local DB + storage)**

Apply the migration to the local DB (`pnpm --filter @owit/db db:push` against a disposable local database, per README guidance), set `INBOUND_EMAIL_SECRET=devsecret`, run the app, and POST a sample Postmark payload:

```bash
curl -X POST http://localhost:3000/api/inbound/email/devsecret \
  -H 'Content-Type: application/json' \
  -d '{"FromFull":{"Email":"<your-auth-user-email>","Name":"Dev"},"MessageID":"smoke-1","Subject":"Smoke test lesson","TextBody":"Body line one\nBody line two","Date":"2026-06-14T10:00:00Z","Attachments":[]}'
```
Expected: `{"status":"captured", ...}`; the item appears at `/inbox`; assigning it creates a draft lesson at `/projects/<id>/lessons/<lessonId>`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: email-to-lesson inbox setup and verification"
```

---

## Self-Review Notes

- **Spec coverage:** ingestion (Tasks 4-5), data model (Task 1), router list/get/discard/assign (Tasks 6-7), UI page + dialog (Task 8), nav badge (Task 9), attachments carried on assign (Tasks 5+7), docs/env (Task 10). Non-goals (Slack/Teams, quoted-trim, ack email, bulk assign, per-user addresses) are excluded.
- **Type consistency:** `inboxItems`/`inboxItemAttachments`/`inboxItemStatusEnum` names match across schema, router, and webhook. `assignToProject` returns `{ lessonId, projectId }`, consumed by the dialog's success toast. `secretMatches`/`parseInboundEmail`/`filterInboundAttachments`/`textToTiptapDoc`/`findUserIdByEmail` signatures match their call sites.
- **Storage:** webhook uploads to `inbox/{itemId}/...`; assign copies to `projects/{projectId}/lesson/{lessonId}/...` (matches `attachment.ts` convention) and inserts `attachments` rows with NOT-NULL `projectId`.
- **Known follow-up for implementer judgment:** Task 8/9 reference existing UI queries (my-projects, project categories) that must be located in-repo; if a project-categories query does not yet exist, add one to `lessonV2Router` mirroring `assertCategoryExists`.
