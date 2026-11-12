import {
  Config,
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { isDocumentContentEmpty } from "@/lib/content";

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Names that are real routes, so they can't be notes. */
export const RESERVED_SLUGS = new Set([
  "ainzooalgown",
  "privacy",
  "api",
  "robots.txt",
  "_next",
  "login",
  "logout",
  "s",
  "manifest.webmanifest",
]);

/** Share link tokens: 12 base64url characters. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{12}$/;

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

/**
 * Turn a title into a note name: "Q3 Plan — Café notes!" -> "q3-plan-cafe-notes".
 * Kept to 48 characters (cut at a word) so a "-2" suffix still fits the 64 limit.
 * Returns "" when nothing usable is left (e.g. a title in another script).
 */
export function slugify(title: string, max = 48): string {
  const s = String(title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const dash = cut.lastIndexOf("-");
  return (dash >= 16 ? cut.slice(0, dash) : cut).replace(/-+$/, "");
}

type LexNode = {
  type?: string;
  text?: string;
  equation?: string;
  children?: LexNode[];
};

export { isDocumentContentEmpty };

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

/** Word count across all text in a document. */
export function countWords(content: object | null | undefined): number {
  if (!content) return 0;
  let words = 0;
  const walk = (node: LexNode) => {
    if (node.type === "text" && node.text) {
      words += node.text.split(/\s+/).filter(Boolean).length;
    }
    node.children?.forEach(walk);
  };
  ((content as { root?: LexNode }).root?.children ?? []).forEach(walk);
  return words;
}
