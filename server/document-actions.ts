"use server";

/**
 * Document functions callable from the browser.
 * Each one checks who is asking: signed-in people (admin or member) for normal
 * notes, or a share token for public "can edit" links.
 * Everything else lives in document-service.ts, which is server-only.
 */

import { getViewer } from "./auth";
import {
  SaveOutcome,
  restorePreviousVersion,
  saveDocumentContent,
  saveSharedContent,
  listSlugsFor,
  slugStatus,
  suggestAvailableSlugs,
} from "./document-service";
import { RESERVED_SLUGS, normaliseSlug } from "./document-utils";
import { clientIp, withinLimit } from "./rate-limit";

export type SaveResult =
  | { ok: true; updated_at: string | null; previous_updated_at: string | null }
  | { ok: false; reason: "locked" | "invalid" | "error" | "forbidden" | "signed-out" | "rate-limited"; message: string }
  | { ok: false; reason: "conflict"; message: string; server_updated_at: string | null };

function toResult(out: SaveOutcome): SaveResult {
  switch (out.kind) {
    case "saved":
      return { ok: true, updated_at: out.updated_at, previous_updated_at: out.previous_updated_at };
    case "locked":
      return { ok: false, reason: "locked", message: "This note is locked." };
    case "forbidden":
      return { ok: false, reason: "forbidden", message: "You no longer have access to this note." };
    case "conflict":
      return {
        ok: false,
        reason: "conflict",
        message: "This note was changed somewhere else.",
        server_updated_at: out.server_updated_at,
      };
  }
}

function toError(err: unknown, where: string): SaveResult {
  console.error(`[${where}]`, err);
  return {
    ok: false,
    reason: "error",
    message: err instanceof Error && err.message.includes("too large") ? err.message : "Couldn't reach the server.",
  };
}

export async function saveDocument(
  slug: string,
  content: object,
  baseUpdatedAt: string | null,
  force = false,
): Promise<SaveResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "signed-out", message: "You were signed out." };

  const normalised = normaliseSlug(slug);
  if (!normalised || RESERVED_SLUGS.has(normalised) || typeof content !== "object" || content === null) {
    return { ok: false, reason: "invalid", message: "Invalid document." };
  }

  try {
    return toResult(await saveDocumentContent(normalised, content, baseUpdatedAt, force, viewer));
  } catch (err) {
    return toError(err, "saveDocument");
  }
}

/** 120 saves per 10 minutes per IP through share links: plenty for a person, slow for a script. */
const SHARE_SAVE_LIMIT = { count: 120, windowMs: 10 * 60 * 1000 };

export async function saveSharedDocument(
  token: string,
  content: object,
  baseUpdatedAt: string | null,
  force = false,
): Promise<SaveResult> {
  if (typeof token !== "string" || typeof content !== "object" || content === null) {
    return { ok: false, reason: "invalid", message: "Invalid document." };
  }
  try {
    const ip = await clientIp();
    if (!(await withinLimit(`share-save:${ip}`, SHARE_SAVE_LIMIT.count, SHARE_SAVE_LIMIT.windowMs))) {
      return {
        ok: false,
        reason: "rate-limited",
        message: "Too many saves in a short time. Wait a few minutes, then try again.",
      };
    }
    return toResult(await saveSharedContent(token, content, baseUpdatedAt, force));
  } catch (err) {
    return toError(err, "saveSharedDocument");
  }
}

export type RestoreResult =
  | { ok: true; content: object | null; updated_at: string; previous_updated_at: string | null }
  | { ok: false; message: string };

export async function restorePrevious(slug: string, baseUpdatedAt: string | null): Promise<RestoreResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "You were signed out. Sign in again." };
  const normalised = normaliseSlug(slug);
  if (!normalised) return { ok: false, message: "Invalid document." };

  try {
    const out = await restorePreviousVersion(normalised, { viewer, baseUpdatedAt });
    switch (out.kind) {
      case "restored":
        return { ok: true, content: out.content, updated_at: out.updated_at, previous_updated_at: out.previous_updated_at };
      case "none":
        return { ok: false, message: "There's no previous version to restore." };
      case "locked":
        return { ok: false, message: "This note is locked." };
      case "forbidden":
        return { ok: false, message: "You no longer have access to this note." };
      case "conflict":
        return { ok: false, message: "This note changed somewhere else. Reload, then try again." };
    }
  } catch (err) {
    console.error("[restorePrevious]", err);
    return { ok: false, message: "Couldn't reach the server." };
  }
}

export type NameCheck =
  | { status: "available"; slug: string }
  | { status: "exists"; slug: string }
  | { status: "invalid"; message: string };

/** Used by the "New note" dialog to give live feedback on a name. */
export async function checkNoteName(input: string): Promise<NameCheck> {
  const viewer = await getViewer();
  if (!viewer) return { status: "invalid", message: "You were signed out. Sign in again." };

  const slug = normaliseSlug(input);
  if (!slug) return { status: "invalid", message: "Use lowercase letters, numbers and dashes (up to 64)." };
  if (RESERVED_SLUGS.has(slug)) return { status: "invalid", message: "That name is reserved." };
  try {
    const status = await slugStatus(slug, viewer);
    if (status === "taken") return { status: "invalid", message: "That name is already taken." };
    return status === "open" ? { status: "exists", slug } : { status: "available", slug };
  } catch {
    // If the check fails, still let them go there; the page itself will load or create it.
    return { status: "available", slug };
  }
}

export async function suggestNoteNames(): Promise<string[]> {
  if (!(await getViewer())) return [];
  try {
    return await suggestAvailableSlugs(4);
  } catch {
    return [];
  }
}

/** Note names for the command palette: everything this person can open, newest first. */
export async function listNoteNames(): Promise<{ slug: string; updated_at: string | null }[]> {
  const viewer = await getViewer();
  if (!viewer) return [];
  try {
    return await listSlugsFor(viewer);
  } catch {
    return [];
  }
}
