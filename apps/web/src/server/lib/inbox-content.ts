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
