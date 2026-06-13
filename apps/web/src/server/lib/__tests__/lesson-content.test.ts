import { describe, expect, it } from "vitest";
import { excerptFromContent } from "../lesson-content";

describe("excerptFromContent", () => {
  it("flattens text nodes into a single line", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Cable pull-in" }] },
        { type: "paragraph", content: [{ type: "text", text: "delayed by weather" }] },
      ],
    };

    expect(excerptFromContent(doc, 200)).toBe("Cable pull-in delayed by weather");
  });

  it("truncates to the max length with an ellipsis", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(50) }] }],
    };

    expect(excerptFromContent(doc, 10)).toBe("xxxxxxxxx…");
  });

  it("returns empty string for null content", () => {
    expect(excerptFromContent(null, 200)).toBe("");
  });
});
