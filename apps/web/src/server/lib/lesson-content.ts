type ContentNode = {
  type?: string;
  text?: string;
  content?: ContentNode[];
};

export function excerptFromContent(content: unknown, maxLength: number): string {
  if (!content || typeof content !== "object") {
    return "";
  }

  const parts: string[] = [];
  const walk = (node: ContentNode) => {
    if (typeof node.text === "string") {
      parts.push(node.text);
    }

    node.content?.forEach(walk);
  };

  walk(content as ContentNode);

  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
