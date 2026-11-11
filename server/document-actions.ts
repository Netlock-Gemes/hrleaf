"use server";

/**
 * The ONLY document functions callable from the browser without admin login.
 * Everything else lives in document-service.ts, which is server-only.
 */

import {
  restorePreviousVersion,
  saveDocumentContent,
  slugExists,
  suggestAvailableSlugs,
} from "./document-service";
import { RESERVED_SLUGS, normaliseSlug } from "./document-utils";

export type SaveResult =
  | { ok: true; updated_at: string | null; previous_updated_at: string | null }
  | { ok: false; reason: "locked" | "invalid" | "error"; message: string }
  | { ok: false; reason: "conflict"; message: string; server_updated_at: string | null };

export async function saveDocument(
  slug: string,
  content: object,
  baseUpdatedAt: string | null,
  force = false,
): Promise<SaveResult> {
  const normalised = normaliseSlug(slug);
  if (!normalised || typeof content !== "object" || content === null) {
    return { ok: false, reason: "invalid", message: "Invalid document." };
  }

  try {
    const out = await saveDocumentContent(normalised, content, baseUpdatedAt, force);
    switch (out.kind) {
      case "saved":
        return { ok: true, updated_at: out.updated_at, previous_updated_at: out.previous_updated_at };
      case "locked":
        return { ok: false, reason: "locked", message: "This note is locked." };
      case "conflict":
        return {
          ok: false,
          reason: "conflict",
          message: "This note was changed somewhere else.",
          server_updated_at: out.server_updated_at,
        };
    }
  } catch (err) {
    console.error("[saveDocument]", err);
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error && err.message.includes("too large")
        ? err.message
        : "Couldn't reach the server.",
    };
  }
}

export type RestoreResult =
  | { ok: true; content: object | null; updated_at: string; previous_updated_at: string | null }
  | { ok: false; message: string };

export async function restorePrevious(
  slug: string,
  baseUpdatedAt: string | null,
): Promise<RestoreResult> {
  const normalised = normaliseSlug(slug);
  if (!normalised) return { ok: false, message: "Invalid document." };

  try {
    const out = await restorePreviousVersion(normalised, { baseUpdatedAt });
    switch (out.kind) {
      case "restored":
        return { ok: true, content: out.content, updated_at: out.updated_at, previous_updated_at: out.previous_updated_at };
      case "none":
        return { ok: false, message: "There's no previous version to restore." };
      case "locked":
        return { ok: false, message: "This note is locked." };
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
  const slug = normaliseSlug(input);
  if (!slug) {
    return { status: "invalid", message: "Use lowercase letters, numbers and dashes (up to 64)." };
  }
  if (RESERVED_SLUGS.has(slug)) return { status: "invalid", message: "That name is reserved." };
  try {
    return (await slugExists(slug)) ? { status: "exists", slug } : { status: "available", slug };
  } catch {
    // If the check fails, still let them go there; the page itself will load or create it.
    return { status: "available", slug };
  }
}

export async function suggestNoteNames(): Promise<string[]> {
  try {
    return await suggestAvailableSlugs(4);
  } catch {
    return [];
  }
}
