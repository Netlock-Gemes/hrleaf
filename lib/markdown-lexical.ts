/**
 * Markdown <-> Lexical editor JSON, without a browser or an editor instance.
 * Used by the MCP endpoint so notes written from outside the app open in the
 * editor exactly as if they had been typed there.
 *
 * Supported: headings, paragraphs, bold / italic / strikethrough / inline code,
 * links (including `/slug` note links), bulleted, numbered and check lists
 * (nested), quotes, code blocks with a language, dividers, GFM tables,
 * `$inline$` and `$$block$$` equations, GitHub alerts (`> [!NOTE]`, `[!TIP]`,
 * `[!WARNING]`, `[!IMPORTANT]`/`[!CAUTION]`) as callouts, and
 * `<details><summary>` as toggles. Anything else becomes plain text.
 */

import { Marked, type MarkedExtension, type Token, type Tokens } from "marked";

import { CALLOUT_LABELS, type CalloutVariant } from "@/lib/blocks";

/* ------------------------------------------------------------------ */
/* JSON node builders                                                  */
/* ------------------------------------------------------------------ */

type J = Record<string, unknown> & { type: string; children?: J[] };

const FORMAT = { bold: 1, italic: 2, strikethrough: 4, underline: 8, code: 16 } as const;

const element = (type: string, children: J[], extra: Record<string, unknown> = {}): J => ({
  children,
  direction: children.length ? "ltr" : null,
  format: "",
  indent: 0,
  type,
  version: 1,
  ...extra,
});

const text = (value: string, format = 0): J => ({
  detail: 0,
  format,
  mode: "normal",
  style: "",
  text: value,
  type: "text",
  version: 1,
});

const linebreak = (): J => ({ type: "linebreak", version: 1 });
const paragraph = (children: J[]): J => element("paragraph", children, { textFormat: 0, textStyle: "" });
const equation = (value: string, inline: boolean): J => ({
  type: "equation",
  version: 1,
  equation: value,
  inline,
  startInEditMode: false,
});

/* ------------------------------------------------------------------ */
/* Markdown -> Lexical                                                 */
/* ------------------------------------------------------------------ */

const mathExtension: MarkedExtension = {
  extensions: [
    {
      name: "blockMath",
      level: "block",
      start: (src) => src.match(/^\$\$/m)?.index,
      tokenizer(src) {
        const m = /^\$\$([\s\S]+?)\$\$[^\S\n]*(?:\n|$)/.exec(src);
        if (m) return { type: "blockMath", raw: m[0], text: m[1].trim() };
      },
    },
    {
      name: "inlineMath",
      level: "inline",
      start: (src) => src.indexOf("$"),
      tokenizer(src) {
        // `$x$`, not `$ 5 and $10` (no space just inside the dollars).
        const m = /^\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/.exec(src);
        if (m) return { type: "inlineMath", raw: m[0], text: m[1] };
      },
    },
  ],
};

const md = new Marked({ gfm: true }, mathExtension);

function lex(markdown: string): Token[] {
  return md.lexer(markdown);
}

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

function inline(tokens: Token[] | undefined, format = 0): J[] {
  const out: J[] = [];
  for (const t of tokens ?? []) {
    switch (t.type) {
      case "strong":
        out.push(...inline((t as Tokens.Strong).tokens, format | FORMAT.bold));
        break;
      case "em":
        out.push(...inline((t as Tokens.Em).tokens, format | FORMAT.italic));
        break;
      case "del":
        out.push(...inline((t as Tokens.Del).tokens, format | FORMAT.strikethrough));
        break;
      case "codespan":
        out.push(text(decode((t as Tokens.Codespan).text), format | FORMAT.code));
        break;
      case "br":
        out.push(linebreak());
        break;
      case "link": {
        const l = t as Tokens.Link;
        const kids = inline(l.tokens, format);
        out.push(element("link", kids.length ? kids : [text(l.href, format)], {
          rel: /^https?:/i.test(l.href) ? "noopener noreferrer" : null,
          target: null,
          title: l.title ?? null,
          url: l.href,
        }));
        break;
      }
      case "image": {
        // No image blocks in HRLeaf: keep it as a link to the image.
        const img = t as Tokens.Image;
        out.push(element("link", [text(img.text || img.href, format)], {
          rel: "noopener noreferrer",
          target: null,
          title: img.title ?? null,
          url: img.href,
        }));
        break;
      }
      case "inlineMath":
        out.push(equation((t as unknown as { text: string }).text, true));
        break;
      case "text": {
        const tt = t as Tokens.Text;
        if (tt.tokens?.length) out.push(...inline(tt.tokens, format));
        else pushText(out, decode(tt.text), format);
        break;
      }
      case "escape":
        pushText(out, (t as Tokens.Escape).text, format);
        break;
      case "html":
      default:
        pushText(out, decode((t as { raw: string }).raw), format);
    }
  }
  return out;
}

/** Plain text, with soft line breaks kept as Lexical line breaks. */
function pushText(out: J[], value: string, format: number) {
  value.split("\n").forEach((line, i) => {
    if (i > 0) out.push(linebreak());
    if (line) out.push(text(line, format));
  });
}

const ALERTS: Record<string, CalloutVariant> = {
  NOTE: "note",
  TIP: "tip",
  WARNING: "warning",
  IMPORTANT: "danger",
  CAUTION: "danger",
};

function blocks(tokens: Token[]): J[] {
  const out: J[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    switch (t.type) {
      case "space":
        break;
      case "heading": {
        const h = t as Tokens.Heading;
        out.push(element("heading", inline(h.tokens), { tag: `h${Math.min(h.depth, 4)}` }));
        break;
      }
      case "paragraph":
        out.push(paragraph(inline((t as Tokens.Paragraph).tokens)));
        break;
      case "text": {
        const tt = t as Tokens.Text;
        out.push(paragraph(tt.tokens ? inline(tt.tokens) : inline([tt])));
        break;
      }
      case "hr":
        out.push({ type: "horizontalrule", version: 1 });
        break;
      case "code": {
        const c = t as Tokens.Code;
        const kids: J[] = [];
        pushText(kids, c.text, 0);
        out.push(element("code", kids, { language: c.lang?.trim().split(/\s/)[0] || undefined }));
        break;
      }
      case "blockMath":
        out.push(paragraph([equation((t as unknown as { text: string }).text, false)]));
        break;
      case "blockquote":
        out.push(quoteOrCallout(t as Tokens.Blockquote));
        break;
      case "list":
        out.push(list(t as Tokens.List));
        break;
      case "table":
        out.push(table(t as Tokens.Table));
        break;
      case "html": {
        const raw = (t as Tokens.HTML).raw;
        if (/^\s*<details[\s>]/i.test(raw)) {
          const consumed = toggle(tokens, i, out);
          if (consumed > 0) {
            i += consumed - 1;
            break;
          }
        }
        if (raw.trim()) out.push(paragraph([text(raw.trim())]));
        break;
      }
      default:
        if ("raw" in t && typeof t.raw === "string" && t.raw.trim()) out.push(paragraph([text(t.raw.trim())]));
    }
  }
  return out;
}

function quoteOrCallout(q: Tokens.Blockquote): J {
  const first = q.tokens[0];
  const m = first?.type === "paragraph" ? /^\[!(\w+)\][^\S\n]*(?:\n|$)/.exec(first.raw) : null;
  const variant = m ? ALERTS[m[1].toUpperCase()] : undefined;
  if (variant) {
    const rest = first.raw.slice(m![0].length);
    const body = [...(rest.trim() ? lex(rest) : []), ...q.tokens.slice(1)];
    const kids = blocks(body);
    return element("callout", kids.length ? kids : [paragraph([])], { variant });
  }
  // A Lexical quote holds inline content only: join its paragraphs with line breaks.
  const kids: J[] = [];
  for (const b of blocks(q.tokens)) {
    if (kids.length) kids.push(linebreak(), linebreak());
    kids.push(...(b.type === "paragraph" || b.type === "heading" ? b.children ?? [] : [text(plain(b))]));
  }
  return element("quote", kids);
}

function list(l: Tokens.List): J {
  const listType = l.items.some((it) => it.task) ? "check" : l.ordered ? "number" : "bullet";
  const start = typeof l.start === "number" ? l.start : 1;
  const items: J[] = [];
  let value = start;
  for (const it of l.items) {
    const content: J[] = [];
    const nested: J[] = [];
    for (const tok of it.tokens) {
      if (tok.type === "checkbox") continue;
      if (tok.type === "list") nested.push(list(tok as Tokens.List));
      else if (tok.type === "text" || tok.type === "paragraph") {
        if (content.length) content.push(linebreak());
        content.push(...inline((tok as Tokens.Text).tokens ?? [tok]));
      } else if (tok.type !== "space") {
        if (content.length) content.push(linebreak());
        content.push(text(plain(blocks([tok])[0] ?? text(""))));
      }
    }
    const extra = listType === "check" ? { checked: !!it.checked, value } : { value };
    items.push(element("listitem", content, extra));
    value++;
    // Lexical nests a list in its own list item, right after its parent item.
    for (const n of nested) items.push(element("listitem", [n], { value: value++ }));
  }
  return element("list", items, { listType, start, tag: l.ordered ? "ol" : "ul" });
}

function table(t: Tokens.Table): J {
  const cell = (c: Tokens.TableCell, header: boolean) =>
    element("tablecell", [paragraph(inline(c.tokens))], {
      backgroundColor: null,
      colSpan: 1,
      headerState: header ? 1 : 0,
      rowSpan: 1,
    });
  const rows = [t.header.map((c) => cell(c, true)), ...t.rows.map((r) => r.map((c) => cell(c, false)))];
  return element("table", rows.map((r) => element("tablerow", r)));
}

/**
 * `<details>` ... `</details>` spread over several tokens. Returns how many
 * tokens it used, or 0 if there's no closing tag (then it's left as text).
 */
function toggle(tokens: Token[], start: number, out: J[]): number {
  let end = -1;
  for (let j = start; j < tokens.length; j++) {
    if (tokens[j].type === "html" && /<\/details>/i.test((tokens[j] as Tokens.HTML).raw)) {
      end = j;
      break;
    }
  }
  if (end < 0) return 0;
  const head = (tokens[start] as Tokens.HTML).raw;
  const open = /<details[^>]*\bopen\b/i.test(head);
  const summary = /<summary>([\s\S]*?)<\/summary>/i.exec(head)?.[1]?.trim() ?? "";
  // Text after </summary> in the same html block, and before </details> in the last one.
  const opener = /<\/summary>/i.test(head) ? /^[\s\S]*?<\/summary>/i : /^[\s\S]*?<details[^>]*>/i;
  const afterSummary = head.replace(opener, "").replace(/<\/details>[\s\S]*$/i, "");
  const inner: Token[] = [];
  if (end === start) {
    if (afterSummary.trim()) inner.push(...lex(afterSummary));
  } else {
    if (afterSummary.trim()) inner.push(...lex(afterSummary));
    inner.push(...tokens.slice(start + 1, end));
    const tail = (tokens[end] as Tokens.HTML).raw.replace(/<\/details>[\s\S]*$/i, "");
    if (tail.trim()) inner.push(...lex(tail));
  }
  const body = blocks(inner);
  out.push(
    element(
      "toggle",
      [
        element("toggle-title", inline(lex(summary).flatMap((x) => ("tokens" in x && x.tokens) || []))),
        element("toggle-content", body.length ? body : [paragraph([])]),
      ],
      { open },
    ),
  );
  return end - start + 1;
}

/** Converts Markdown to a Lexical editor state (the JSON HRLeaf stores). */
export function markdownToLexical(markdown: string): { root: J } {
  const children = blocks(lex(markdown.replace(/\r\n?/g, "\n")));
  return { root: element("root", children) };
}

/* ------------------------------------------------------------------ */
/* Lexical -> Markdown                                                 */
/* ------------------------------------------------------------------ */

type N = {
  type?: string;
  children?: N[];
  text?: string;
  format?: number | string;
  tag?: string;
  listType?: string;
  start?: number;
  checked?: boolean;
  url?: string;
  language?: string;
  headerState?: number;
  equation?: string;
  inline?: boolean;
  variant?: string;
  open?: boolean;
};

function plain(node: N): string {
  if (node.type === "text" || node.type === "code-highlight") return node.text ?? "";
  if (node.type === "linebreak") return "\n";
  if (node.type === "tab") return "\t";
  if (node.type === "equation") return node.equation ?? "";
  return (node.children ?? []).map(plain).join("");
}

function inlineMd(nodes: N[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      switch (n.type) {
        case "text": {
          const f = typeof n.format === "number" ? n.format : 0;
          let s = n.text ?? "";
          if (f & FORMAT.code) return "`" + s + "`";
          if (!s.trim()) return s;
          const lead = s.match(/^\s*/)![0];
          const trail = s.match(/\s*$/)![0];
          s = s.trim();
          if (f & FORMAT.strikethrough) s = `~~${s}~~`;
          if (f & FORMAT.italic) s = `*${s}*`;
          if (f & FORMAT.bold) s = `**${s}**`;
          return lead + s + trail;
        }
        case "code-highlight":
          return n.text ?? "";
        case "linebreak":
          return "\n";
        case "tab":
          return "\t";
        case "link":
        case "autolink":
          return `[${inlineMd(n.children)}](${n.url ?? ""})`;
        case "equation":
          return n.inline === false ? `$$${n.equation}$$` : `$${n.equation}$`;
        default:
          return inlineMd(n.children);
      }
    })
    .join("");
}

const indentLines = (s: string, pad: string) =>
  s
    .split("\n")
    .map((l, i) => (i === 0 || !l ? l : pad + l))
    .join("\n");

function listMd(node: N, depth: number): string {
  const lines: string[] = [];
  let n = node.start ?? 1;
  const pad = "  ".repeat(depth);
  for (const item of node.children ?? []) {
    const nested = (item.children ?? []).filter((c) => c.type === "list");
    if (nested.length && nested.length === item.children?.length) {
      for (const l of nested) lines.push(listMd(l, depth + 1));
      continue;
    }
    const marker =
      node.listType === "number" ? `${n++}.` : node.listType === "check" ? `- [${item.checked ? "x" : " "}]` : "-";
    const body = inlineMd((item.children ?? []).filter((c) => c.type !== "list"));
    lines.push(`${pad}${marker} ${indentLines(body, pad + "  ")}`);
    for (const l of nested) lines.push(listMd(l, depth + 1));
  }
  return lines.join("\n");
}

const cellMd = (n: N) =>
  (n.children ?? [])
    .map((c) => (c.type === "paragraph" ? inlineMd(c.children) : plain(c)))
    .join(" ")
    .replace(/\n/g, " ")
    .replace(/\|/g, "\\|");

function blockMd(node: N): string {
  switch (node.type) {
    case "paragraph":
      return inlineMd(node.children);
    case "heading": {
      const level = Number(node.tag?.slice(1)) || 2;
      return `${"#".repeat(level)} ${inlineMd(node.children)}`;
    }
    case "quote":
      return inlineMd(node.children)
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n");
    case "list":
      return listMd(node, 0);
    case "code":
      return "```" + (node.language ?? "") + "\n" + plain(node) + "\n```";
    case "horizontalrule":
      return "---";
    case "equation":
      return node.inline ? `$${node.equation}$` : `$$${node.equation}$$`;
    case "table": {
      const rows = (node.children ?? []).map((r) => (r.children ?? []).map(cellMd));
      if (!rows.length) return "";
      const width = Math.max(...rows.map((r) => r.length));
      const fmt = (r: string[]) => `| ${[...r, ...Array(width - r.length).fill("")].join(" | ")} |`;
      return [fmt(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map(fmt)].join("\n");
    }
    case "callout": {
      const label = (CALLOUT_LABELS as Record<string, string>)[node.variant ?? "note"] ?? "Note";
      const body = docMd(node.children);
      return [`> [!${label.toUpperCase()}]`, ...body.split("\n").map((l) => (l ? `> ${l}` : ">"))].join("\n");
    }
    case "toggle": {
      const title = node.children?.find((c) => c.type === "toggle-title");
      const content = node.children?.find((c) => c.type === "toggle-content");
      return `<details${node.open !== false ? " open" : ""}>\n<summary>${inlineMd(title?.children)}</summary>\n\n${docMd(content?.children)}\n\n</details>`;
    }
    default:
      return node.children ? docMd(node.children) : plain(node);
  }
}

function docMd(nodes: N[] | undefined): string {
  return blocksMarkdown(nodes ?? []).text;
}

export type BlockSpan = { index: number; start: number; end: number };

/**
 * Markdown for a list of top-level blocks, joined by blank lines, plus where
 * each block sits in that text. Empty blocks (blank paragraphs) are skipped in
 * the text but keep their index, so edits can map text back to blocks.
 */
export function blocksMarkdown(blocks: object[]): { text: string; spans: BlockSpan[] } {
  let text = "";
  const spans: BlockSpan[] = [];
  blocks.forEach((b, index) => {
    const md = blockMd(b as N).replace(/^\n+|\s+$/g, "");
    if (!md) return;
    if (text) text += "\n\n";
    spans.push({ index, start: text.length, end: text.length + md.length });
    text += md;
  });
  return { text, spans };
}

/** Converts a stored Lexical editor state back to Markdown. */
export function lexicalToMarkdown(content: object | null | undefined): string {
  const root = (content as { root?: N } | null)?.root;
  return docMd(root?.children);
}

/** Top-level headings: their level (1-6), text and position among the root's children. */
export function outline(blocks: object[]): { level: number; text: string; index: number }[] {
  return (blocks as N[]).flatMap((b, index) =>
    b.type === "heading" ? [{ level: Number(b.tag?.slice(1)) || 2, text: plain(b).trim(), index }] : [],
  );
}
