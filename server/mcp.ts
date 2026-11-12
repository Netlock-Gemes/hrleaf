/**
 * MCP (Model Context Protocol) server, so Claude Code, claude.ai and the Claude
 * apps can write and update notes. Writing only: no sharing, visibility or deleting.
 * Served by app/api/mcp/route.ts (bearer token) and app/api/mcp/[secret]/route.ts
 * (secret in the address).
 *
 * Streamable HTTP transport, stateless, JSON responses (no SSE stream).
 * Disabled (404) unless MCP_TOKEN is set to 32+ characters. The token can open
 * every note; edits show as made by MCP_AUTHOR (default "claude") and go
 * through the same save path as the editor, so the previous version is kept
 * and conflicts are detected (changes are re-applied to the newer text).
 */

import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { lexicalToMarkdown, markdownToLexical } from "@/lib/markdown-lexical";
import {
  Block,
  EditError,
  Placement,
  TextEdit,
  applyTextEdits,
  listHeadings,
  placeMarkdown,
  sectionMarkdown,
} from "@/lib/note-edits";
import { safeEqual } from "@/lib/session";
import { audit } from "@/server/audit";
import {
  findAvailableSlug,
  listNotesFor,
  loadEditorDocument,
  nextFreeSlug,
  saveDocumentContent,
  searchNoteText,
  slugStatus,
} from "@/server/document-service";
import { RESERVED_SLUGS, derivedFields, normaliseSlug, slugify } from "@/server/document-utils";
import { Viewer } from "@/types";

const SERVER_INFO = { name: "hrleaf", version: "1.5.0" };
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_MARKDOWN = 500_000;
const MAX_EDITS = 50;

const INSTRUCTIONS = `HRLeaf is a private notebook. Each note has a name (its "slug", e.g. "weekly-plan") and lives at <site>/<slug>.
Write in Markdown: headings, **bold**, *italic*, ~~strike~~, \`code\`, links, lists, - [ ] checklists, > quotes, \`\`\`lang code blocks, ---, GFM tables, $inline$ and $$block$$ LaTeX, > [!NOTE] / [!TIP] / [!WARNING] / [!IMPORTANT] callouts, and <details><summary>Title</summary> ... </details> toggles. Link another note with [text](/its-slug).
Work fast and small:
- To put text in a note that may already exist, call hrleaf_create_note with if_exists "append" (one call, no search needed).
- To add under a heading, use hrleaf_update_note with "section".
- To change a few words or lines, use hrleaf_edit_note (old_text -> new_text) instead of rewriting the note. Copy old_text from hrleaf_read_note output.
- For a long note, read with outline_only or section first instead of the whole note.
- Use hrleaf_search_notes to find a note by words in its name or text.`;

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

const SLUG_PROP = { type: "string", description: "The note's name, e.g. 'weekly-plan'." } as const;

const TOOLS = [
  {
    name: "hrleaf_create_note",
    title: "Create note",
    description:
      "Write a note from Markdown. The name (slug) is made from the title: 'Q3 Launch Plan' -> 'q3-launch-plan'. " +
      "If a note with that name exists: if_exists 'new' (default) makes 'q3-launch-plan-2'; 'append' adds the text to the end of the existing note instead.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Human title, used to make the name, e.g. 'Q3 launch plan'." },
        markdown: { type: "string", description: "The note body in Markdown. A new note usually starts with '# Title'." },
        slug: { type: "string", description: "Optional exact name instead of one made from the title (a-z, 0-9, dashes, max 64)." },
        if_exists: { type: "string", enum: ["new", "append"], description: "Default 'new'." },
      },
      required: ["title", "markdown"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hrleaf_update_note",
    title: "Add to note",
    description:
      "Add Markdown to a note: at the end ('append', default), at the start ('prepend'), or instead of its text ('replace'). " +
      "With 'section' (a heading's text, e.g. 'Tasks'), it works inside that section only: append = end of the section, prepend = just under the heading, replace = the section's body (the heading stays). " +
      "Replacing keeps the old text as the note's previous version.",
    inputSchema: {
      type: "object",
      properties: {
        slug: SLUG_PROP,
        markdown: { type: "string", description: "Markdown to add, or the new text for 'replace'." },
        mode: { type: "string", enum: ["append", "prepend", "replace"], description: "Default 'append'." },
        section: { type: "string", description: "Optional heading text to work under, e.g. 'Tasks' or '## Tasks'." },
      },
      required: ["slug", "markdown"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hrleaf_edit_note",
    title: "Edit note",
    description:
      "Change exact text in a note without resending the rest: each edit replaces old_text with new_text. " +
      "old_text is matched against the note's Markdown (as hrleaf_read_note shows it, e.g. '**bold**', '- [ ] item') and must appear once unless replace_all is set. " +
      "Empty new_text deletes. All edits apply together, or none do. Only the blocks touched are rewritten.",
    inputSchema: {
      type: "object",
      properties: {
        slug: SLUG_PROP,
        edits: {
          type: "array",
          minItems: 1,
          maxItems: MAX_EDITS,
          items: {
            type: "object",
            properties: {
              old_text: { type: "string" },
              new_text: { type: "string" },
              replace_all: { type: "boolean", description: "Replace every occurrence. Default false." },
            },
            required: ["old_text", "new_text"],
            additionalProperties: false,
          },
        },
      },
      required: ["slug", "edits"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hrleaf_read_note",
    title: "Read note",
    description:
      "Read a note as Markdown. For long notes, use outline_only to see just its headings, or section to read one part.",
    inputSchema: {
      type: "object",
      properties: {
        slug: SLUG_PROP,
        section: { type: "string", description: "Optional heading text: read only that section." },
        outline_only: { type: "boolean", description: "Only list the headings. Default false." },
      },
      required: ["slug"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "hrleaf_search_notes",
    title: "Search notes",
    description:
      "Find notes whose name or text contains every word of the query (any case), name matches first. Without a query, lists the most recently edited notes.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for, e.g. 'mumbai invoice'." },
        limit: { type: "integer", minimum: 1, maximum: 40, description: "Default 15." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const;

class ToolError extends Error {}

type Args = Record<string, unknown>;
type Ctx = { viewer: Viewer; site: string };

const str = (args: Args, key: string, required = false): string | undefined => {
  const v = args[key];
  if (v === undefined || v === null || v === "") {
    if (required) throw new ToolError(`"${key}" is required.`);
    return undefined;
  }
  if (typeof v !== "string") throw new ToolError(`"${key}" must be a string.`);
  return v;
};

function oneOf<T extends string>(args: Args, key: string, allowed: readonly T[], fallback: T): T {
  const v = str(args, key) ?? fallback;
  if (!(allowed as readonly string[]).includes(v)) throw new ToolError(`"${key}" must be ${allowed.join(", ")}.`);
  return v as T;
}

function markdownArg(args: Args) {
  const md = typeof args.markdown === "string" ? args.markdown : str(args, "markdown", true)!;
  if (md.length > MAX_MARKDOWN) throw new ToolError(`Markdown is too long (max ${MAX_MARKDOWN} characters).`);
  return md;
}

function toSlug(raw: string): string {
  const slug = normaliseSlug(raw.trim().replace(/^\/+/, ""));
  if (!slug) throw new ToolError(`"${raw}" isn't a valid note name (a-z, 0-9 and dashes, max 64).`);
  return slug;
}

const slugArg = (args: Args) => toSlug(str(args, "slug", true)!);

async function openNote(slug: string) {
  const doc = await loadEditorDocument(slug);
  if (!doc || doc.deleted || !doc.updated_at) {
    throw new ToolError(`There's no note called "${slug}". Use hrleaf_search_notes to find it, or create it.`);
  }
  return doc;
}

const blocksOf = (content: object | null): Block[] =>
  ((content as { root?: { children?: Block[] } } | null)?.root?.children ?? []) as Block[];

const saveFailure = (kind: string, slug: string) =>
  kind === "locked"
    ? `"${slug}" is locked, so it can't be changed.`
    : kind === "conflict"
      ? `"${slug}" keeps being saved by someone else right now. Try again in a moment.`
      : `"${slug}" can't be changed (it may be in the trash).`;

/**
 * Read the note, apply `change` to its blocks and save. If someone saved in
 * between, read again and re-apply (up to 3 tries), so nothing is overwritten.
 */
async function changeNote(slug: string, viewer: Viewer, change: (blocks: Block[]) => Block[]) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const doc = await openNote(slug);
    if (doc.read_only) throw new ToolError(saveFailure("locked", slug));
    const root = (doc.content as { root?: object } | null)?.root ?? markdownToLexical("").root;
    const content = { root: { ...root, children: change(blocksOf(doc.content)) } };
    if (derivedFields(content).is_empty) {
      throw new ToolError("That would leave the note empty. Nothing was saved.");
    }
    const out = await saveDocumentContent(slug, content, doc.updated_at, false, viewer);
    if (out.kind === "saved") return;
    if (out.kind !== "conflict") throw new ToolError(saveFailure(out.kind, slug));
  }
  throw new ToolError(saveFailure("conflict", slug));
}

async function createNote(args: Args, { viewer, site }: Ctx) {
  const title = str(args, "title", true)!;
  const markdown = markdownArg(args);
  const ifExists = oneOf(args, "if_exists", ["new", "append"] as const, "new");

  const content = markdownToLexical(markdown);
  if (derivedFields(content).is_empty) throw new ToolError("The note would be empty.");

  const explicit = str(args, "slug") ? slugArg(args) : null;
  const base = explicit ?? slugify(title);

  if (base && ifExists === "append" && (await slugStatus(base, viewer)) === "open") {
    const doc = await openNote(base).catch(() => null);
    if (doc) {
      await changeNote(base, viewer, (blocks) => placeMarkdown(blocks, markdown, "append"));
      return `Added to the end of the existing note "${base}": ${site}/${base}`;
    }
  }

  let slug: string;
  if (explicit) {
    if (RESERVED_SLUGS.has(explicit)) throw new ToolError(`"${explicit}" is reserved by the app. Pick another name.`);
    if ((await slugStatus(explicit, viewer)) !== "free") {
      throw new ToolError(
        `A note called "${explicit}" already exists. Use if_exists "append", hrleaf_update_note, or another name.`,
      );
    }
    slug = explicit;
  } else {
    slug = base ? await nextFreeSlug(base) : await findAvailableSlug();
  }

  // Creates only if the name is still free (base version null); a race shows up as a conflict.
  let out = await saveDocumentContent(slug, content, null, false, viewer);
  if (out.kind === "conflict" && !explicit) {
    slug = await nextFreeSlug(base || slug);
    out = await saveDocumentContent(slug, content, null, false, viewer);
  }
  if (out.kind !== "saved") throw new ToolError(saveFailure(out.kind, slug));
  await audit({ actor: viewer.username, action: "created a note via MCP", target: slug });

  return `Created "${slug}": ${site}/${slug}`;
}

async function updateNote(args: Args, { viewer, site }: Ctx) {
  const slug = slugArg(args);
  const markdown = markdownArg(args);
  const mode = oneOf<Placement>(args, "mode", ["append", "prepend", "replace"], "append");
  const section = str(args, "section");
  if (mode !== "replace" && !markdown.trim()) throw new ToolError("Nothing to add.");

  await changeNote(slug, viewer, (blocks) => placeMarkdown(blocks, markdown, mode, section));

  const where = section ? ` the "${section.replace(/^\s*#+\s*/, "")}" section of` : "";
  const verb =
    mode === "replace"
      ? `Replaced the text of${where}`
      : mode === "append"
        ? `Added to the end of${where}`
        : section
          ? `Added to the top of${where}`
          : "Added to the start of";
  const undo = mode === "replace" ? " The old text is kept as its previous version." : "";
  return `${verb} "${slug}": ${site}/${slug}${undo}`;
}

function editsArg(args: Args): TextEdit[] {
  const raw = args.edits;
  if (!Array.isArray(raw) || raw.length === 0) throw new ToolError(`"edits" must be a list of { old_text, new_text }.`);
  if (raw.length > MAX_EDITS) throw new ToolError(`At most ${MAX_EDITS} edits at a time.`);
  return raw.map((e, i) => {
    const o = e as Record<string, unknown>;
    if (typeof o?.old_text !== "string" || typeof o?.new_text !== "string") {
      throw new ToolError(`Edit ${i + 1} needs old_text and new_text as strings.`);
    }
    if (o.new_text.length > MAX_MARKDOWN) throw new ToolError(`Edit ${i + 1} is too long.`);
    return { old_text: o.old_text, new_text: o.new_text, replace_all: o.replace_all === true };
  });
}

async function editNote(args: Args, { viewer, site }: Ctx) {
  const slug = slugArg(args);
  const edits = editsArg(args);
  await changeNote(slug, viewer, (blocks) => applyTextEdits(blocks, edits));
  return `Made ${edits.length} edit${edits.length === 1 ? "" : "s"} to "${slug}": ${site}/${slug}`;
}

async function readNote(args: Args, { site }: Ctx) {
  const slug = slugArg(args);
  const section = str(args, "section");
  const doc = await openNote(slug);
  const blocks = blocksOf(doc.content);
  const header = [
    `Note: ${slug} (${site}/${slug})`,
    `Last saved ${doc.updated_at}${doc.updated_by ? ` by ${doc.updated_by}` : ""}${doc.read_only ? " · locked" : ""}`,
  ].join("\n");
  if (args.outline_only === true) return `${header}\n\nHeadings:\n${listHeadings(blocks)}`;
  const body = section ? sectionMarkdown(blocks, section) : lexicalToMarkdown(doc.content);
  return `${header}\n\n---\n\n${body}`;
}

async function searchNotes(args: Args, { viewer, site }: Ctx) {
  const q = (str(args, "query") ?? "").trim();
  const limitRaw = args.limit ?? 15;
  if (typeof limitRaw !== "number" || !Number.isInteger(limitRaw)) throw new ToolError(`"limit" must be a whole number.`);
  const limit = Math.min(Math.max(limitRaw, 1), 40);
  const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "never");

  if (!q) {
    const { rows, total } = await listNotesFor(viewer, "", 0);
    if (!rows.length) return "There are no notes yet.";
    const lines = rows.slice(0, limit).map((r) => `- ${r.slug} (saved ${day(r.updated_at)})${r.preview ? ` — ${r.preview.slice(0, 120)}` : ""}`);
    return `Most recent notes (${site}/<name>):\n${lines.join("\n")}${total > lines.length ? `\n…and ${total - lines.length} more.` : ""}`;
  }

  const { hits } = await searchNoteText(viewer, q, limit);
  if (!hits.length) return `No notes contain "${q}" in their name or text.`;
  const lines = hits.map((h) => `- ${h.slug} (saved ${day(h.updated_at)}${h.inName ? ", name match" : ""}) — ${h.snippet}`);
  return `Notes matching "${q}" (${site}/<name>):\n${lines.join("\n")}`;
}

const HANDLERS: Record<string, (args: Args, ctx: Ctx) => Promise<string>> = {
  hrleaf_create_note: createNote,
  hrleaf_update_note: updateNote,
  hrleaf_edit_note: editNote,
  hrleaf_read_note: readNote,
  hrleaf_search_notes: searchNotes,
};

/* ------------------------------------------------------------------ */
/* JSON-RPC                                                            */
/* ------------------------------------------------------------------ */

type RpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Args };

const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

async function handle(msg: RpcRequest, ctx: Ctx): Promise<object | null> {
  const isNotification = msg.id === undefined;
  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return isNotification ? null : rpcError(msg?.id, -32600, "Invalid request");
  }
  if (isNotification) return null; // notifications/initialized, cancelled, ...

  const ok = (result: object) => ({ jsonrpc: "2.0", id: msg.id, result });
  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return ok({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const handler = HANDLERS[name];
      if (!handler) return rpcError(msg.id, -32602, `Unknown tool: ${name}`);
      const args = (msg.params?.arguments ?? {}) as Args;
      if (typeof args !== "object" || Array.isArray(args)) return rpcError(msg.id, -32602, "Arguments must be an object");
      try {
        const text = await handler(args, ctx);
        return ok({ content: [{ type: "text", text }] });
      } catch (err) {
        if (!(err instanceof ToolError || err instanceof EditError)) console.error("[hrleaf:error] mcp", name, err);
        const text =
          err instanceof ToolError || err instanceof EditError
            ? err.message
            : err instanceof Error && err.message.includes("too large")
              ? err.message
              : "Something went wrong on the server.";
        return ok({ content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

/** A secret from the environment, or null when it's unset or shorter than 32 characters. */
function secret(name: "MCP_TOKEN" | "MCP_URL_SECRET"): string | null {
  const t = process.env[name]?.trim();
  return t && t.length >= 32 ? t : null;
}

export type McpAuth = { kind: "header" } | { kind: "path"; given: string };

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Two ways in, each off unless its secret is set:
 * - /api/mcp with "Authorization: Bearer <MCP_TOKEN>" (Claude Code)
 * - /api/mcp/<MCP_URL_SECRET> with no header, for clients that can't send
 *   headers (claude.ai custom connectors, so the Claude mobile apps). A wrong
 *   secret is a plain 404, so the address itself reveals nothing.
 */
async function check(request: NextRequest, auth: McpAuth): Promise<NextResponse | null> {
  if (auth.kind === "path") {
    const want = secret("MCP_URL_SECRET");
    if (!want || !(await safeEqual(auth.given, want))) return new NextResponse(null, { status: 404 });
    return null;
  }
  const token = secret("MCP_TOKEN");
  if (!token) return new NextResponse(null, { status: 404 });
  const given = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!given || !(await safeEqual(given, token))) return json(rpcError(null, -32001, "Unauthorized"), 401);
  return null;
}

export async function mcpPost(request: NextRequest, auth: McpAuth) {
  const denied = await check(request, auth);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  const author = (process.env.MCP_AUTHOR || "claude").trim().slice(0, 40) || "claude";
  const ctx: Ctx = {
    viewer: { id: "mcp", role: "admin", username: author, name: author },
    site: (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/+$/, ""),
  };

  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map((m) => handle(m as RpcRequest, ctx)))).filter(Boolean);
    return replies.length ? json(replies) : new NextResponse(null, { status: 202 });
  }
  const reply = await handle(body as RpcRequest, ctx);
  return reply ? json(reply) : new NextResponse(null, { status: 202 });
}

/** GET (server stream) and DELETE (end session) aren't offered: clients fall back to plain POSTs. */
export async function mcpOther(request: NextRequest, auth: McpAuth) {
  const denied = await check(request, auth);
  if (denied?.status === 404) return denied;
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
