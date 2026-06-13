import { describe, expect, it } from "vitest";
import { excerptFromContent } from "../lib/lesson-content";

describe("updateLesson description derivation", () => {
  it("derives description from content when content is provided", () => {
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "New body" }] }],
    };

    const derived = excerptFromContent(content, 280);
    expect(derived).toBe("New body");
  });
});
