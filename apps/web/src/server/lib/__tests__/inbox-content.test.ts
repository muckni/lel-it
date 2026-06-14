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
