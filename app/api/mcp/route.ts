/**
 * MCP (Model Context Protocol) endpoint, so Claude Code and other MCP clients
 * can create, read and update notes.
 *
 *   claude mcp add --transport http hrleaf https://<site>/api/mcp \
 *     --header "Authorization: Bearer <MCP_TOKEN>"
 *
 * Streamable HTTP transport, stateless, JSON responses (no SSE stream).
 * Disabled (404) unless MCP_TOKEN is set to 32+ characters. The token acts as
 * the admin, so it can open every note; edits show as made by MCP_AUTHOR
 * (default "claude") and go through the same save path as the editor, so the
 * previous version is kept and conflicts are detected.
 */

import { NextRequest, NextResponse } from "next/server";

import { lexicalToMarkdown, markdownToLexical } from "@/lib/markdown-lexical";
import { safeEqual } from "@/lib/session";
import { audit } from "@/server/audit";
import {
  findAvailableSlug,
  getEditorDocument,
  listNotesFor,
  nextFreeSlug,
  saveDocumentContent,
  setVisibilityMany,
  slugStatus,
} from "@/server/document-service";
import { RESERVED_SLUGS, derivedFields, normaliseSlug, slugify } from "@/server/document-utils";
import { Viewer } from "@/types";

export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "hrleaf", version: "1.4.0" };
const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_MARKDOWN = 500_000;

const INSTRUCTIONS = `HRLeaf is a private notebook. Each note has a name (its "slug", e.g. "weekly-plan") and lives at <site>/<slug>.
Write note bodies in Markdown: headings, **bold**, *italic*, ~~strike~~, \`code\`, links, lists, - [ ] checklists, > quotes, \`\`\`lang code blocks, ---, GFM tables, $inline$ and $$block$$ LaTeX, > [!NOTE] / [!TIP] / [!WARNING] / [!IMPORTANT] callouts, and <details><summary>Title</summary> ... </details> toggles. Link another note with [text](/its-slug).
To add to an existing note use hrleaf_update_note with mode "append" rather than creating a duplicate; search first if unsure whether it exists.`;

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

const TOOLS = [
  {
    name: "hrleaf_create_note",
    title: "Create note",
    description:
      "Create a new HRLeaf note from Markdown. The note name (slug) is made from the title (lowercase, dashes); if that name is taken, -2, -3... is added. Returns the slug and URL.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Human title, used to make the slug, e.g. 'Q3 launch plan'." },
        markdown: {
          type: "string",
          description: "The note body in Markdown. Usually starts with a '# Title' heading.",
        },
        slug: {
          type: "string",
          description:
            "Optional exact name instead of one made from the title: a-z, 0-9 and dashes, max 64. Fails if taken.",
        },
        visibility: {
          type: "string",
          enum: ["team", "private"],
          description: "'team' (default): admin and members. 'private': admin only.",
        },
      },
      required: ["title", "markdown"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hrleaf_update_note",
    title: "Update note",
    description:
      "Add Markdown to an existing note (append at the end, or prepend at the start), or replace its whole body. Replacing keeps the old text as the note's previous version, restorable from the note's ⋯ menu.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The note's name, e.g. 'weekly-plan'." },
        markdown: { type: "string", description: "Markdown to add, or the new full body for 'replace'." },
        mode: { type: "string", enum: ["append", "prepend", "replace"], description: "Default 'append'." },
      },
      required: ["slug", "markdown"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "hrleaf_read_note",
    title: "Read note",
    description: "Read a note as Markdown, with when and by whom it was last saved.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "The note's name." } },
      required: ["slug"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "hrleaf_search_notes",
    title: "Search notes",
    description:
      "List notes, most recently edited first, optionally only those whose name contains the query. Returns names, URLs and a short text preview.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of a note name, e.g. 'plan'. Omit to list recent notes." },
        limit: { type: "integer", minimum: 1, maximum: 40, description: "Default 20." },
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

function markdownArg(args: Args) {
  const md = str(args, "markdown", true)!;
  if (md.length > MAX_MARKDOWN) throw new ToolError(`Markdown is too long (max ${MAX_MARKDOWN} characters).`);
  return md;
}

function slugArg(args: Args): string {
  const raw = str(args, "slug", true)!;
  const slug = normaliseSlug(raw.replace(/^\/+/, ""));
  if (!slug) throw new ToolError(`"${raw}" isn't a valid note name (a-z, 0-9 and dashes, max 64).`);
  return slug;
}

async function openNote(slug: string) {
  const doc = await getEditorDocument(slug);
  if (!doc || doc.deleted || !doc.updated_at) {
    throw new ToolError(`There's no note called "${slug}". Use hrleaf_search_notes to find it, or create it.`);
  }
  return doc;
}

const saveFailure = (kind: string, slug: string) =>
  kind === "locked"
    ? `"${slug}" is locked. Unlock it in the admin area first.`
    : kind === "conflict"
      ? `"${slug}" was saved by someone else just now. Read it again and retry.`
      : `"${slug}" can't be saved (it may be in the trash).`;

async function createNote(args: Args, { viewer, site }: Ctx) {
  const title = str(args, "title", true)!;
  const markdown = markdownArg(args);
  const visibility = str(args, "visibility") ?? "team";
  if (visibility !== "team" && visibility !== "private") throw new ToolError(`"visibility" must be team or private.`);

  const content = markdownToLexical(markdown);
  if (derivedFields(content).is_empty) throw new ToolError("The note would be empty.");

  const explicit = str(args, "slug");
  let slug: string;
  if (explicit) {
    slug = slugArg(args);
    if (RESERVED_SLUGS.has(slug)) throw new ToolError(`"${slug}" is reserved by the app. Pick another name.`);
    if ((await slugStatus(slug, viewer)) !== "free") {
      throw new ToolError(`A note called "${slug}" already exists. Use hrleaf_update_note, or pick another name.`);
    }
  } else {
    const base = slugify(title);
    slug = base ? await nextFreeSlug(base) : await findAvailableSlug();
  }

  // Creates only if the name is still free (base version null); a race shows up as a conflict.
  let out = await saveDocumentContent(slug, content, null, false, viewer);
  if (out.kind === "conflict" && !explicit) {
    slug = await nextFreeSlug(slugify(title) || slug);
    out = await saveDocumentContent(slug, content, null, false, viewer);
  }
  if (out.kind !== "saved") throw new ToolError(saveFailure(out.kind, slug));
  if (visibility === "private") await setVisibilityMany([slug], "private");
  await audit({ actor: viewer.username, action: "created a note via MCP", target: slug });

  return `Created "${slug}"${visibility === "private" ? " (only me)" : ""}: ${site}/${slug}`;
}

async function updateNote(args: Args, { viewer, site }: Ctx) {
  const slug = slugArg(args);
  const markdown = markdownArg(args);
  const mode = str(args, "mode") ?? "append";
  if (!["append", "prepend", "replace"].includes(mode)) throw new ToolError(`"mode" must be append, prepend or replace.`);

  const doc = await openNote(slug);
  if (doc.read_only) throw new ToolError(saveFailure("locked", slug));

  const added = markdownToLexical(markdown).root;
  if (mode !== "replace" && !added.children?.length) throw new ToolError("Nothing to add.");
  const old = (doc.content as { root?: { children?: object[] } } | null)?.root;
  const content =
    mode === "replace"
      ? { root: added }
      : {
          root: {
            ...added,
            ...old,
            children:
              mode === "append"
                ? [...(old?.children ?? []), ...(added.children ?? [])]
                : [...(added.children ?? []), ...(old?.children ?? [])],
          },
        };
  if (mode === "replace" && derivedFields(content).is_empty) {
    throw new ToolError("Replacing with nothing would empty the note. Move it to the trash in the app instead.");
  }

  const out = await saveDocumentContent(slug, content, doc.updated_at, false, viewer);
  if (out.kind !== "saved") throw new ToolError(saveFailure(out.kind, slug));

  const verb = mode === "replace" ? "Replaced the text of" : mode === "append" ? "Added to the end of" : "Added to the start of";
  const undo = mode === "replace" ? " The old text is kept as its previous version." : "";
  return `${verb} "${slug}": ${site}/${slug}${undo}`;
}

async function readNote(args: Args, { site }: Ctx) {
  const slug = slugArg(args);
  const doc = await openNote(slug);
  const facts = [
    `Note: ${slug}`,
    `URL: ${site}/${slug}`,
    `Last saved: ${doc.updated_at}${doc.updated_by ? ` by ${doc.updated_by}` : ""}`,
    `Visibility: ${doc.visibility === "private" ? "only me" : "team"}${doc.read_only ? ", locked" : ""}`,
  ];
  return `${facts.join("\n")}\n\n---\n\n${lexicalToMarkdown(doc.content)}`;
}

async function searchNotes(args: Args, { viewer, site }: Ctx) {
  const q = (str(args, "query") ?? "").trim().toLowerCase();
  const limitRaw = args.limit ?? 20;
  if (typeof limitRaw !== "number" || !Number.isInteger(limitRaw)) throw new ToolError(`"limit" must be a whole number.`);
  const limit = Math.min(Math.max(limitRaw, 1), 40);

  const { rows, total } = await listNotesFor(viewer, q, 0);
  if (!rows.length) return q ? `No notes with "${q}" in their name.` : "There are no notes yet.";
  const lines = rows.slice(0, limit).map((r) => {
    const preview = r.preview ? ` — ${r.preview.slice(0, 140)}` : "";
    return `- ${r.slug} (${site}/${r.slug}, saved ${r.updated_at ?? "never"})${preview}`;
  });
  const more = total > lines.length ? `\n…and ${total - lines.length} more.` : "";
  return `${lines.join("\n")}${more}`;
}

const HANDLERS: Record<string, (args: Args, ctx: Ctx) => Promise<string>> = {
  hrleaf_create_note: createNote,
  hrleaf_update_note: updateNote,
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
        if (!(err instanceof ToolError)) console.error("[hrleaf:error] mcp", name, err);
        const text =
          err instanceof ToolError
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

function configuredToken(): string | null {
  const t = process.env.MCP_TOKEN?.trim();
  return t && t.length >= 32 ? t : null;
}

async function authorised(request: NextRequest, token: string) {
  const given = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  return given.length > 0 && (await safeEqual(given, token));
}

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  const token = configuredToken();
  if (!token) return new NextResponse(null, { status: 404 });
  if (!(await authorised(request, token))) {
    return json(rpcError(null, -32001, "Unauthorized"), 401);
  }

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

/** No server-initiated stream: clients fall back to plain request/response. */
export async function GET() {
  return new NextResponse(null, { status: configuredToken() ? 405 : 404, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: configuredToken() ? 405 : 404, headers: { Allow: "POST" } });
}
