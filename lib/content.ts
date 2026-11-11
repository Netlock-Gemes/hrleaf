/** Pure helpers for Lexical editor JSON, safe to use in the browser and on the server. */

type LexNode = {
  type?: string;
  text?: string;
  equation?: string;
  children?: LexNode[];
};

/** True when a Lexical editor state holds no meaningful content. */
export function isDocumentContentEmpty(
  content: object | null | undefined,
): boolean {
  if (!content) return true;
  const rootChildren: LexNode[] =
    (content as { root?: { children?: LexNode[] } })?.root?.children ?? [];

  const hasContent = (node: LexNode): boolean => {
    if (node?.type === "text") return Boolean(node.text?.trim());
    if (Array.isArray(node?.children)) {
      // Empty paragraphs etc. don't count; any leaf node (rule, equation...) does.
      return node.children.length > 0
        ? node.children.some(hasContent)
        : node.type !== "paragraph" && node.type !== "heading";
    }
    return Boolean(node?.type);
  };

  return !rootChildren.some(hasContent);
}

