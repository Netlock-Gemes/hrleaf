import {
  Config,
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Names that are real routes, so they can't be notes. */
export const RESERVED_SLUGS = new Set(["ainzooalgown", "privacy", "api", "robots.txt", "_next"]);

/** Lowercase and validate a slug. Returns null if it isn't a usable document name. */
export function normaliseSlug(input: string): string | null {
  let slug: string;
  try {
    slug = decodeURIComponent(String(input)).trim().toLowerCase();
  } catch {
    return null;
  }
  return SLUG_PATTERN.test(slug) ? slug : null;
}

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

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "listitem",
  "code",
  "tablecell",
]);

/** Plain-text excerpt of a document, for admin lists. */
export function extractPreview(content: object | null | undefined, max = 280): string {
  if (!content) return "";
  const parts: string[] = [];
  let length = 0;

  const walk = (node: LexNode) => {
    if (length >= max) return;
    if (node.type === "text" && node.text) {
      parts.push(node.text);
      length += node.text.length;
    } else if (node.type === "equation" && node.equation) {
      parts.push(node.equation);
      length += node.equation.length;
    } else if (node.type === "linebreak") {
      parts.push(" ");
    }
    node.children?.forEach(walk);
    if (node.type && BLOCK_TYPES.has(node.type)) parts.push(" · ");
  };

  ((content as { root?: LexNode }).root?.children ?? []).forEach(walk);
  return parts
    .join("")
    .replace(/(\s·\s)+/g, " · ")
    .replace(/\s+/g, " ")
    .replace(/^ · | · $/g, "")
    .trim()
    .slice(0, max);
}

/** Fields stored alongside content on every write. */
export function derivedFields(content: object | null) {
  return {
    preview: extractPreview(content),
    size: content ? JSON.stringify(content).length : 0,
    is_empty: isDocumentContentEmpty(content),
  };
}

const nameConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: "-",
};

export function generateRandomSlug(): string {
  return uniqueNamesGenerator(nameConfig)
    .toLowerCase()
    .replace(/[^a-z-]/g, "");
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
