import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db, inboxItems, inboxItemAttachments } from "@owit/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { ATTACHMENT_BUCKET, sanitizeAttachmentFileName } from "@/lib/attachments";
import {
  parseInboundEmail,
  filterInboundAttachments,
  secretMatches,
} from "@/server/lib/inbound-email";
import { findUserIdByEmail } from "@/server/lib/user-lookup";

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

  const { accepted, skipped } = filterInboundAttachments(email.attachments);
  if (skipped.length > 0) {
    console.warn(
      `[inbound-email] skipped ${skipped.length} attachment(s) (size/type) on item ${item.id}`
    );
  }
  if (accepted.length > 0) {
    const admin = createAdminClient();
    for (const att of accepted) {
      try {
        const attachmentId = randomUUID();
        const safeName = sanitizeAttachmentFileName(att.Name);
        const storagePath = `inbox/${item.id}/${attachmentId}/${safeName}`;
        const bytes = Buffer.from(att.Content, "base64");
        const { error } = await admin.storage
          .from(ATTACHMENT_BUCKET)
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
