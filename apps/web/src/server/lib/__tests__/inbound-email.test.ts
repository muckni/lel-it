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
