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
