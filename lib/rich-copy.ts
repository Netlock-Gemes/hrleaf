/**
 * Copy part of a note "as it looks": bold, italics, lists, checklists, tables,
 * links and headings survive a paste into Gmail, Outlook, Docs or Word, and a
 * plain-text version goes along for apps that only take text (WhatsApp, SMS).
 *
 * Works from the rendered page (live editor or read-only view), so every place
 * a note is shown copies the same way. Styles are written inline because email
 * apps drop class names, and no text colour is set so the paste takes the
 * colours of wherever it lands.
 */

const SAFE_URL = /^(https?:|mailto:|tel:)/i;

const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "DIV", "UL", "OL", "TABLE", "HR"]);

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Pieces of the page that are controls, not content. */
function isChrome(el: Element): boolean {
  if (el.tagName === "BUTTON" || el.tagName === "COLGROUP" || el.tagName === "STYLE" || el.tagName === "SCRIPT") return true;
  if (el.tagName === "svg" || el.tagName === "SVG") return true;
  return el.matches(
    ".editor-copyblock-bar, .editor-callout-icon, .editor-toggle-chevron, .editor-table-add-columns, .editor-table-add-rows, [data-copy-skip]",
  );
}

/** Inline styles for text formats shown with class names in the editor. */
function textStyle(el: Element): string {
  const c = el.classList;
  const parts: string[] = [];
  if (c.contains("editor-text-bold")) parts.push("font-weight:bold");
  if (c.contains("editor-text-italic")) parts.push("font-style:italic");
  const lines: string[] = [];
  if (c.contains("editor-text-underline") || c.contains("editor-text-underlineStrikethrough")) lines.push("underline");
  if (c.contains("editor-text-strikethrough") || c.contains("editor-text-underlineStrikethrough")) lines.push("line-through");
  if (lines.length) parts.push(`text-decoration:${lines.join(" ")}`);
  return parts.join(";");
}

function alignStyle(el: HTMLElement): string {
  const a = el.style?.textAlign;
  return a && a !== "left" && a !== "start" ? `text-align:${a}` : "";
}

/** Code-block text with its line breaks (Lexical shows them as <br>). */
function codeText(el: Element): string {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) out += n.textContent ?? "";
    else if ((n as Element).tagName === "BR") out += "\n";
    else if (n.nodeType === Node.ELEMENT_NODE) out += codeText(n as Element);
  });
  return out;
}

function make(tag: string, style = ""): HTMLElement {
  const el = document.createElement(tag);
  if (style) el.setAttribute("style", style);
  return el;
}

function convertChildren(src: Node, into: Node) {
  src.childNodes.forEach((child) => {
    const out = convert(child);
    if (out) into.appendChild(out);
  });
}

/** A clean copy of one rendered node, or null to leave it out. */
function convert(src: Node): Node | null {
  if (src.nodeType === Node.TEXT_NODE) return document.createTextNode(src.textContent ?? "");
  if (src.nodeType !== Node.ELEMENT_NODE) return null;
  const el = src as HTMLElement;
  if (isChrome(el)) return null;
  const tag = el.tagName;
  const c = el.classList;

  // Equations: their TeX source, since rendered maths doesn't survive a paste.
  if (c.contains("editor-equation")) {
    const tex = el.dataset.equation ?? el.querySelector("code")?.textContent ?? el.textContent ?? "";
    const code = make("code", `font-family:${MONO}`);
    code.textContent = c.contains("editor-equation-block") ? `$$${tex}$$` : `$${tex}$`;
    if (!c.contains("editor-equation-block")) return code;
    const p = make("p");
    p.appendChild(code);
    return p;
  }

  // Code block (a <code> element with line breaks inside).
  if (c.contains("editor-code")) {
    const pre = make("pre", `font-family:${MONO};font-size:13px;background:#f6f6f4;border:1px solid #e2e2de;border-radius:4px;padding:10px 12px;white-space:pre-wrap`);
    pre.textContent = codeText(el);
    return pre;
  }

  // Inline code.
  if (tag === "CODE" || c.contains("editor-text-code")) {
    const code = make("code", `font-family:${MONO};font-size:0.92em;background:#f2f2ef;border-radius:3px;padding:1px 4px`);
    convertChildren(el, code);
    return code;
  }

  // Callout: a ruled box with a green edge.
  if (c.contains("editor-callout")) {
    const box = make("div", "border-left:3px solid #4cc47e;background:#f4faf6;padding:8px 14px;margin:8px 0");
    const body = el.querySelector(":scope > .editor-callout-body") ?? el;
    convertChildren(body, box);
    return box;
  }

  // A copy block inside what's being copied: just its contents.
  if (c.contains("editor-copyblock")) {
    const body = el.querySelector(":scope > .editor-copyblock-body") ?? el;
    const div = make("div");
    convertChildren(body, div);
    return div;
  }

  // Toggle: title in bold, then its contents.
  if (c.contains("editor-toggle-title") || tag === "SUMMARY") {
    const p = make("p", "font-weight:bold");
    const text = el.querySelector(".editor-toggle-title-text") ?? el;
    convertChildren(text, p);
    return p;
  }

  if (c.contains("editor-table-scrollable-wrapper")) {
    const frag = document.createDocumentFragment();
    convertChildren(el, frag);
    return frag;
  }

  switch (tag) {
    case "BR":
      return make("br");
    case "HR":
      return make("hr", "border:0;border-top:1px solid #d6d6d2;margin:12px 0");
    case "P":
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6": {
      const out = make(tag.toLowerCase(), [alignStyle(el), tag === "P" ? "margin:0 0 0.5em" : "margin:0.8em 0 0.4em"].filter(Boolean).join(";"));
      convertChildren(el, out);
      return out;
    }
    case "BLOCKQUOTE": {
      const out = make("blockquote", "margin:8px 0;padding:2px 0 2px 12px;border-left:3px solid #d6d6d2");
      convertChildren(el, out);
      return out;
    }
    case "UL":
    case "OL": {
      const check = c.contains("editor-checklist");
      const out = make(tag.toLowerCase(), check ? "list-style:none;padding-left:4px;margin:0 0 0.5em" : "margin:0 0 0.5em;padding-left:24px");
      const start = el.getAttribute("start");
      if (tag === "OL" && start && start !== "1") out.setAttribute("start", start);
      convertChildren(el, out);
      return out;
    }
    case "LI": {
      const nested = c.contains("editor-nested-listitem");
      const checked = el.getAttribute("aria-checked");
      const out = make("li", nested ? "list-style:none" : "");
      if (checked !== null && !nested) out.appendChild(document.createTextNode(checked === "true" ? "☑ " : "☐ "));
      convertChildren(el, out);
      return out;
    }
    case "TABLE": {
      const out = make("table", "border-collapse:collapse;margin:8px 0");
      convertChildren(el, out);
      return out;
    }
    case "TBODY":
    case "THEAD":
    case "TR": {
      const out = make(tag.toLowerCase());
      convertChildren(el, out);
      return out;
    }
    case "TD":
    case "TH": {
      const out = make(tag.toLowerCase(), `border:1px solid #d6d6d2;padding:4px 10px;vertical-align:top;text-align:left${tag === "TH" ? ";font-weight:bold;background:#f4f4f1" : ""}`);
      for (const a of ["colspan", "rowspan"]) {
        const v = el.getAttribute(a);
        if (v && v !== "1") out.setAttribute(a, v);
      }
      convertChildren(el, out);
      // Cells hold paragraphs; keep them from adding space inside the cell.
      out.querySelectorAll("p").forEach((p) => p.style.setProperty("margin", "0"));
      return out;
    }
    case "A": {
      const href = el.getAttribute("href") ?? "";
      const out = make("a");
      if (SAFE_URL.test(href)) out.setAttribute("href", href);
      else if (href.startsWith("/")) out.setAttribute("href", location.origin + href);
      convertChildren(el, out);
      return out;
    }
    case "SUB":
    case "SUP": {
      const out = make(tag.toLowerCase());
      convertChildren(el, out);
      return out;
    }
  }

  // Bold/italic/underline/strike (and anything else): keep the look, drop the wrapper.
  const style = textStyle(el);
  if (style || tag === "STRONG" || tag === "B" || tag === "EM" || tag === "I") {
    const out = make("span", style || (tag === "STRONG" || tag === "B" ? "font-weight:bold" : "font-style:italic"));
    convertChildren(el, out);
    return out;
  }
  const frag = document.createDocumentFragment();
  convertChildren(el, frag);
  // Unknown block wrappers still end a line.
  if (BLOCK_TAGS.has(tag) || tag === "SECTION" || tag === "ASIDE" || tag === "DETAILS") {
    const div = make("div");
    div.appendChild(frag);
    return div;
  }
  return frag;
}

/* -------------------------------- plain text ------------------------------- */

function plain(node: Node, out: string[], listDepth: number) {
  node.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out.push(n.textContent ?? "");
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    const tag = el.tagName;
    const newline = () => {
      if (out.length && !out[out.length - 1].endsWith("\n")) out.push("\n");
    };
    switch (tag) {
      case "BR":
        out.push("\n");
        return;
      case "HR":
        newline();
        out.push("———\n");
        return;
      case "PRE":
        newline();
        out.push((el.textContent ?? "") + "\n");
        return;
      case "UL":
      case "OL": {
        newline();
        let i = Number(el.getAttribute("start") ?? 1);
        el.childNodes.forEach((li) => {
          if ((li as Element).tagName !== "LI") return;
          const item = li as HTMLElement;
          const onlyList = [...item.children].every((k) => k.tagName === "UL" || k.tagName === "OL") && item.children.length > 0;
          if (onlyList) {
            plain(item, out, listDepth + 1);
            return;
          }
          const text = item.textContent ?? "";
          const isCheck = text.startsWith("☑ ") || text.startsWith("☐ ");
          const marker = tag === "OL" ? `${i++}. ` : isCheck ? "" : "• ";
          out.push("  ".repeat(listDepth) + marker);
          plain(item, out, listDepth + 1);
          newline();
        });
        return;
      }
      case "TR": {
        newline();
        const cells = [...el.children].map((cell) => {
          const parts: string[] = [];
          plain(cell, parts, 0);
          return parts.join("").replace(/\s*\n\s*/g, " ").trim();
        });
        out.push(cells.join("\t") + "\n");
        return;
      }
      default:
        if (BLOCK_TAGS.has(tag) || tag === "LI") {
          newline();
          plain(el, out, tag === "UL" || tag === "OL" ? listDepth : listDepth);
          newline();
          return;
        }
        plain(el, out, listDepth);
    }
  });
}

/* ---------------------------------- copy ---------------------------------- */

/** Clean HTML and plain text for the contents of `el`. */
export function richContent(el: Element): { html: string; text: string } {
  const root = document.createElement("div");
  convertChildren(el, root);
  // Drop trailing empty paragraphs.
  while (root.lastElementChild && root.lastElementChild.tagName === "P" && !root.lastElementChild.textContent?.trim()) {
    root.lastElementChild.remove();
  }
  const parts: string[] = [];
  plain(root, parts, 0);
  const text = parts.join("").replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { html: root.innerHTML, text };
}

/** Old-style copy, for browsers without the async clipboard (or when it's refused). */
function copyWithSelection(html: string, text: string): boolean {
  const onCopy = (e: ClipboardEvent) => {
    e.preventDefault();
    e.clipboardData?.setData("text/html", html);
    e.clipboardData?.setData("text/plain", text);
  };
  document.addEventListener("copy", onCopy, true);
  try {
    return document.execCommand("copy");
  } finally {
    document.removeEventListener("copy", onCopy, true);
  }
}

/** Copies `el`'s contents with formatting. Resolves true when it worked. */
export async function copyRich(el: Element): Promise<boolean> {
  const { html, text } = richContent(el);
  if (!text && !html) return false;
  const doc = `<meta charset="utf-8"><div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5">${html}</div>`;
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([doc], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return true;
    }
  } catch {
    // Fall through to the older way.
  }
  return copyWithSelection(doc, text);
}
