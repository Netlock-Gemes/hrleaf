/**
 * Small, targeted changes to a note's top-level blocks, for the MCP endpoint.
 * Only the blocks an edit touches are rebuilt from Markdown; every other block
 * keeps its exact stored JSON, so formatting Markdown can't express survives.
 */

import { blocksMarkdown, lexicalToMarkdown, markdownToLexical, outline } from "@/lib/markdown-lexical";

export type Block = object;

export class EditError extends Error {}

const parse = (markdown: string): Block[] => (markdownToLexical(markdown).root.children ?? []) as Block[];

/* ------------------------------------------------------------------ */
/* Find and replace                                                    */
/* ------------------------------------------------------------------ */

export type TextEdit = { old_text: string; new_text: string; replace_all?: boolean };

function occurrences(text: string, needle: string): number[] {
  const out: number[] = [];
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + needle.length)) out.push(i);
  return out;
}

/** Apply one find-and-replace to the note's Markdown, rebuilding only the blocks it touches. */
export function applyTextEdit(blocks: Block[], edit: TextEdit): Block[] {
  const { old_text: oldText, new_text: newText } = edit;
  if (!oldText) throw new EditError("old_text can't be empty.");
  if (oldText === newText) throw new EditError("old_text and new_text are the same.");

  const { text, spans } = blocksMarkdown(blocks);
  const hits = occurrences(text, oldText);
  const shown = oldText.length > 80 ? `${oldText.slice(0, 80)}…` : oldText;
  if (hits.length === 0) {
    throw new EditError(
      `Couldn't find "${shown}" in the note. Copy the text exactly from hrleaf_read_note (Markdown, e.g. **bold**).`,
    );
  }
  if (hits.length > 1 && !edit.replace_all) {
    throw new EditError(
      `"${shown}" appears ${hits.length} times. Include more surrounding text so it's unique, or set replace_all.`,
    );
  }

  // Group the hits into runs of whole blocks (overlapping runs merge).
  const runs: { first: number; last: number }[] = [];
  for (const at of hits) {
    const end = at + oldText.length;
    const touched = spans.filter((s) => s.end > at && s.start < end);
    if (!touched.length) throw new EditError("old_text only covers the space between blocks; include some text.");
    const first = spans.indexOf(touched[0]);
    const last = spans.indexOf(touched[touched.length - 1]);
    const prev = runs[runs.length - 1];
    if (prev && first <= prev.last) prev.last = Math.max(prev.last, last);
    else runs.push({ first, last });
  }

  // Right to left, so earlier block indexes stay valid.
  const out = [...blocks];
  for (const run of runs.reverse()) {
    const from = spans[run.first];
    const to = spans[run.last];
    const segment = text.slice(from.start, to.end).split(oldText).join(newText);
    out.splice(from.index, to.index - from.index + 1, ...parse(segment));
  }
  return out;
}

export function applyTextEdits(blocks: Block[], edits: TextEdit[]): Block[] {
  return edits.reduce((acc, e, i) => {
    try {
      return applyTextEdit(acc, e);
    } catch (err) {
      if (err instanceof EditError && edits.length > 1) {
        throw new EditError(`Edit ${i + 1} of ${edits.length}: ${err.message} No edits were saved.`);
      }
      throw err;
    }
  }, blocks);
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

/** "## Tasks", "tasks", " Tasks " all name the same heading. */
const norm = (s: string) =>
  s
    .replace(/^\s*#+\s*/, "")
    .replace(/[*_`~]/g, "")
    .trim()
    .toLowerCase();

export function listHeadings(blocks: Block[]): string {
  const hs = outline(blocks);
  return hs.length ? hs.map((h) => `${"#".repeat(h.level)} ${h.text}`).join("\n") : "(this note has no headings)";
}

/**
 * The section under a heading: from the heading to just before the next
 * heading of the same or a higher level (or the end of the note).
 */
export function findSection(blocks: Block[], name: string) {
  const hs = outline(blocks);
  const want = norm(name);
  let matches = hs.filter((h) => norm(h.text) === want);
  if (!matches.length) matches = hs.filter((h) => norm(h.text).includes(want));
  if (!matches.length) {
    throw new EditError(`No heading "${name}" in this note. Its headings are:\n${listHeadings(blocks)}`);
  }
  if (matches.length > 1) {
    throw new EditError(
      `"${name}" matches ${matches.length} headings: ${matches.map((m) => `"${m.text}"`).join(", ")}. Use the full heading text.`,
    );
  }
  const h = matches[0];
  const next = hs.find((o) => o.index > h.index && o.level <= h.level);
  return { heading: h.index, bodyStart: h.index + 1, end: next ? next.index : blocks.length };
}

export type Placement = "append" | "prepend" | "replace";

type ListJson = { type?: string; listType?: string; children?: object[] };

/** Two lists of the same kind side by side become one (the first keeps its numbering start). */
function mergeLists(a: Block, b: Block): Block | null {
  const x = a as ListJson;
  const y = b as ListJson;
  if (x.type !== "list" || y.type !== "list" || x.listType !== y.listType) return null;
  return { ...x, children: [...(x.children ?? []), ...(y.children ?? [])] };
}

/** Insert blocks at `at`, joining a list item onto a list right next to it. */
function insertAt(blocks: Block[], at: number, added: Block[]): Block[] {
  const items = [...added];
  let start = at;
  let end = at;
  if (items.length && at > 0) {
    const m = mergeLists(blocks[at - 1], items[0]);
    if (m) {
      items[0] = m;
      start = at - 1;
    }
  }
  if (items.length && at < blocks.length) {
    const m = mergeLists(items[items.length - 1], blocks[at]);
    if (m) {
      items[items.length - 1] = m;
      end = at + 1;
    }
  }
  return [...blocks.slice(0, start), ...items, ...blocks.slice(end)];
}

/** Add Markdown to the whole note or to one section. */
export function placeMarkdown(blocks: Block[], markdown: string, mode: Placement, section?: string): Block[] {
  const added = parse(markdown);
  if (!section) {
    if (mode === "replace") return added;
    return insertAt(blocks, mode === "append" ? blocks.length : 0, added);
  }
  const s = findSection(blocks, section);
  if (mode === "append") return insertAt(blocks, s.end, added);
  if (mode === "prepend") return insertAt(blocks, s.bodyStart, added);
  return [...blocks.slice(0, s.bodyStart), ...added, ...blocks.slice(s.end)];
}

/** Markdown for one section, heading included. */
export function sectionMarkdown(blocks: Block[], name: string): string {
  const s = findSection(blocks, name);
  return lexicalToMarkdown({ root: { children: blocks.slice(s.heading, s.end) } });
}
