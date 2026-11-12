import "server-only";

import { randomBytes } from "node:crypto";

import { Filter } from "mongodb";
import { cache } from "react";

import {
  AdminFilter,
  AdminListResult,
  AdminQuery,
  AdminStats,
  Document,
  DocumentSummary,
  EditorDocument,
  ShareMode,
  StorageInfo,
  Viewer,
  Visibility,
} from "@/types";

import { RESERVED_SLUGS, SHARE_TOKEN_PATTERN, countWords, derivedFields, escapeRegex, generateRandomSlug } from "./document-utils";
import { connectToMongo, documents } from "./mongo-config";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024; // 2 MB of editor JSON
export const ADMIN_PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

const EDITOR_PROJECTION = {
  _id: 0,
  slug: 1,
  content: 1,
  read_only: 1,
  updated_at: 1,
  updated_by: 1,
  previous_updated_at: 1,
  visibility: 1,
  share: 1,
  deleted_at: 1,
} as const;

function toEditorDocument(doc: Partial<Document> & { slug: string }): EditorDocument {
  return {
    slug: doc.slug,
    content: doc.content ?? null,
    read_only: doc.read_only === true,
    updated_at: doc.updated_at ?? null,
    updated_by: doc.updated_by ?? null,
    previous_updated_at: doc.previous_updated_at ?? null,
    visibility: doc.visibility === "private" ? "private" : "team",
    share: doc.share?.token ? doc.share : null,
    deleted: !!doc.deleted_at,
  };
}

/** Wrapped in React cache so metadata + page share one query per request. */
export const getEditorDocument = cache(async (slug: string): Promise<EditorDocument | null> => {
  const col = await documents();
  const doc = await col.findOne({ slug }, { projection: EDITOR_PROJECTION });
  return doc ? toEditorDocument(doc) : null;
});

/** The note behind a public share link, or null if the link is unknown or the note is in the trash. */
export const getSharedDocument = cache(async (token: string): Promise<EditorDocument | null> => {
  if (!SHARE_TOKEN_PATTERN.test(token)) return null;
  const col = await documents();
  const doc = await col.findOne(
    { "share.token": token, deleted_at: { $exists: false } },
    { projection: EDITOR_PROJECTION },
  );
  return doc ? toEditorDocument(doc) : null;
});

/**
 * Can this signed-in person open this note at its normal address?
 * A note that doesn't exist yet is open to anyone signed in (they're about to create it).
 */
export function canOpen(viewer: Viewer, doc: EditorDocument | null): boolean {
  if (viewer.role === "admin") return true;
  if (!doc) return true;
  return !doc.deleted && doc.visibility !== "private";
}

/** Content-free facts about a note, for titles and link previews. */
export function noteFacts(doc: EditorDocument | null) {
  return {
    exists: !!doc && !!doc.content,
    words: countWords(doc?.content),
    updated_at: doc?.updated_at ?? null,
    read_only: doc?.read_only ?? false,
  };
}

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

export type SaveOutcome =
  | { kind: "saved"; updated_at: string | null; previous_updated_at: string | null }
  | { kind: "locked" }
  | { kind: "forbidden" }
  | { kind: "conflict"; server_updated_at: string | null };

const hasCurrent = { $ne: [{ $ifNull: ["$content", null] }, null] };

/** The pipeline update shared by every save path. */
function savePipeline(content: object | null, by: string, now: string) {
  const derived = derivedFields(content);
  if (derived.size > MAX_CONTENT_BYTES) {
    throw new Error("Document is too large to save.");
  }
  const stored = derived.is_empty ? null : content;
  return {
    stored,
    pipeline: [
      {
        $set: {
          previous_content: { $cond: [hasCurrent, "$content", "$previous_content"] },
          previous_updated_at: { $cond: [hasCurrent, "$updated_at", "$previous_updated_at"] },
          content: { $literal: stored },
          preview: { $literal: derived.preview },
          size: derived.size,
          is_empty: derived.is_empty,
          updated_at: now,
          updated_by: { $literal: by },
          read_only: { $ifNull: ["$read_only", false] },
          visibility: { $ifNull: ["$visibility", "team"] },
          version: { $ifNull: ["$version", 1] },
          created_at: { $ifNull: ["$created_at", now] },
          created_by: { $ifNull: ["$created_by", { $literal: by }] },
        },
      },
    ],
  };
}

/**
 * Save content in one atomic write, as a signed-in person.
 * - Keeps exactly one previous version (the content this save replaces).
 * - Refuses locked notes, notes in the trash, and (for members) admin-only notes.
 * - Detects conflicts: `baseUpdatedAt` must match what's stored, unless `force`.
 */
export async function saveDocumentContent(
  slug: string,
  content: object | null,
  baseUpdatedAt: string | null,
  force: boolean,
  viewer: Viewer,
): Promise<SaveOutcome> {
  const now = new Date().toISOString();
  const { stored, pipeline } = savePipeline(content, viewer.username, now);
  const col = await documents();

  const filter: Filter<Document> = { slug, read_only: { $ne: true }, deleted_at: { $exists: false } };
  if (viewer.role !== "admin") filter.visibility = { $ne: "private" };
  if (!force) filter.updated_at = baseUpdatedAt ?? { $exists: false };

  // Never create a brand-new document just to store nothing.
  if (stored === null && baseUpdatedAt === null && !force) {
    const exists = await col.countDocuments({ slug }, { limit: 1 });
    if (!exists) return { kind: "saved", updated_at: null, previous_updated_at: null };
  }

  try {
    const result = await col.findOneAndUpdate(filter, pipeline, {
      upsert: true,
      returnDocument: "after",
      projection: { previous_updated_at: 1 },
    });
    return { kind: "saved", updated_at: now, previous_updated_at: result?.previous_updated_at ?? null };
  } catch (err) {
    // Duplicate key: the slug exists but didn't match. Work out why.
    if ((err as { code?: number }).code !== 11000) throw err;
    const current = await col.findOne(
      { slug },
      { projection: { read_only: 1, updated_at: 1, visibility: 1, deleted_at: 1 } },
    );
    if (!current || current.deleted_at) return { kind: "forbidden" };
    if (current.visibility === "private" && viewer.role !== "admin") return { kind: "forbidden" };
    if (current.read_only) return { kind: "locked" };
    return { kind: "conflict", server_updated_at: current.updated_at ?? null };
  }
}

/** Save through a public "can edit" share link. Never creates notes. */
export async function saveSharedContent(
  token: string,
  content: object | null,
  baseUpdatedAt: string | null,
  force: boolean,
): Promise<SaveOutcome> {
  if (!SHARE_TOKEN_PATTERN.test(token)) return { kind: "forbidden" };
  const now = new Date().toISOString();
  const { pipeline } = savePipeline(content, "share link", now);
  const col = await documents();

  const filter: Filter<Document> = {
    "share.token": token,
    "share.mode": "write",
    read_only: { $ne: true },
    deleted_at: { $exists: false },
  };
  if (!force) filter.updated_at = baseUpdatedAt ?? { $exists: false };

  const result = await col.findOneAndUpdate(filter, pipeline, {
    returnDocument: "after",
    projection: { previous_updated_at: 1 },
  });
  if (result) return { kind: "saved", updated_at: now, previous_updated_at: result.previous_updated_at ?? null };

  const current = await col.findOne(
    { "share.token": token },
    { projection: { read_only: 1, updated_at: 1, share: 1, deleted_at: 1 } },
  );
  if (!current || current.deleted_at || current.share?.mode !== "write") return { kind: "forbidden" };
  if (current.read_only) return { kind: "locked" };
  return { kind: "conflict", server_updated_at: current.updated_at ?? null };
}

export type RestoreOutcome =
  | { kind: "restored"; content: object | null; updated_at: string; previous_updated_at: string | null }
  | { kind: "none" }
  | { kind: "locked" }
  | { kind: "forbidden" }
  | { kind: "conflict" };

/**
 * Swap the current content with the single previous version.
 * Running it twice puts things back, so a restore is always undoable.
 */
export async function restorePreviousVersion(
  slug: string,
  { viewer, baseUpdatedAt }: { viewer: Viewer; baseUpdatedAt?: string | null },
): Promise<RestoreOutcome> {
  const asAdmin = viewer.role === "admin";
  const col = await documents();
  const doc = await col.findOne(
    { slug },
    {
      projection: {
        content: 1,
        updated_at: 1,
        read_only: 1,
        visibility: 1,
        deleted_at: 1,
        previous_content: 1,
        previous_updated_at: 1,
      },
    },
  );
  if (!doc || doc.deleted_at) return { kind: "none" };
  if (doc.visibility === "private" && !asAdmin) return { kind: "forbidden" };
  if (doc.previous_content === undefined || doc.previous_content === null) return { kind: "none" };
  // The editor never restores a locked note; the admin table may.
  if (doc.read_only && baseUpdatedAt !== undefined) return { kind: "locked" };
  if (baseUpdatedAt !== undefined && (doc.updated_at ?? null) !== baseUpdatedAt) {
    return { kind: "conflict" };
  }

  const now = new Date().toISOString();
  const restored = doc.previous_content;
  const res = await col.updateOne(
    { slug, updated_at: doc.updated_at },
    {
      $set: {
        content: restored,
        previous_content: doc.content ?? null,
        previous_updated_at: doc.updated_at,
        updated_at: now,
        updated_by: viewer.username,
        ...derivedFields(restored),
      },
    },
  );
  if (res.matchedCount === 0) return { kind: "conflict" };
  return { kind: "restored", content: restored, updated_at: now, previous_updated_at: doc.updated_at ?? null };
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

const LIST_PROJECTION = {
  _id: 0,
  slug: 1,
  read_only: 1,
  created_at: 1,
  updated_at: 1,
  updated_by: 1,
  preview: 1,
  size: 1,
  is_empty: 1,
  visibility: 1,
  share: 1,
  deleted_at: 1,
  has_previous: { $ne: [{ $ifNull: ["$previous_content", null] }, null] },
} as const;

type ListRow = Partial<Document> & { slug: string; has_previous?: boolean };

function toSummary(r: ListRow): DocumentSummary {
  return {
    slug: r.slug,
    read_only: r.read_only === true,
    created_at: r.created_at,
    updated_at: r.updated_at,
    updated_by: r.updated_by,
    preview: r.preview ?? "",
    size: r.size ?? 0,
    is_empty: r.is_empty === true,
    has_previous: r.has_previous === true,
    visibility: r.visibility === "private" ? "private" : "team",
    share: r.share?.token ? r.share : null,
    deleted_at: r.deleted_at ? new Date(r.deleted_at).toISOString() : undefined,
  };
}

const live = { deleted_at: { $exists: false } };

/** Admin table: every note, with filters. */
export async function listDocuments(query: AdminQuery): Promise<AdminListResult> {
  const col = await documents();

  const base: Filter<Document> = query.q ? { slug: { $regex: escapeRegex(query.q) } } : {};
  const byFilter: Record<AdminFilter, Filter<Document>> = {
    all: live,
    shared: { ...live, "share.token": { $exists: true } },
    private: { ...live, visibility: "private" },
    locked: { ...live, read_only: true },
    empty: { ...live, is_empty: true },
    trash: { deleted_at: { $exists: true } },
  };
  const match: Filter<Document> = { ...base, ...byFilter[query.filter] };
  // In the trash, newest-deleted first unless sorting by something explicit.
  const sortField = query.filter === "trash" && query.sort === "updated_at" ? "deleted_at" : query.sort;
  const dir = query.desc ? -1 : 1;

  const isLive = { $eq: [{ $ifNull: ["$deleted_at", null] }, null] };
  const when = (cond: object) => ({ $sum: { $cond: [{ $and: [isLive, cond] }, 1, 0] } });

  const [rows, countsAgg] = await Promise.all([
    col
      .find(match, { projection: LIST_PROJECTION })
      .sort({ [sortField]: dir, slug: 1 })
      .skip(query.page * ADMIN_PAGE_SIZE)
      .limit(ADMIN_PAGE_SIZE)
      .toArray(),
    col
      .aggregate<Record<AdminFilter, number>>([
        { $match: base },
        {
          $group: {
            _id: null,
            all: when({ $literal: true }),
            shared: when({ $ne: [{ $ifNull: ["$share.token", null] }, null] }),
            private: when({ $eq: ["$visibility", "private"] }),
            locked: when({ $eq: ["$read_only", true] }),
            empty: when({ $eq: ["$is_empty", true] }),
            trash: { $sum: { $cond: [isLive, 0, 1] } },
          },
        },
      ])
      .toArray(),
  ]);

  const c = countsAgg[0];
  const counts: Record<AdminFilter, number> = {
    all: c?.all ?? 0,
    shared: c?.shared ?? 0,
    private: c?.private ?? 0,
    locked: c?.locked ?? 0,
    empty: c?.empty ?? 0,
    trash: c?.trash ?? 0,
  };
  return {
    rows: rows.map((r) => toSummary(r as ListRow)),
    total: counts[query.filter],
    counts,
    pageSize: ADMIN_PAGE_SIZE,
  };
}

export const HOME_PAGE_SIZE = 40;

/** Home screen: the notes this person can open, most recently edited first. Empty notes are skipped. */
export async function listNotesFor(viewer: Viewer, q: string, page: number) {
  const col = await documents();
  const match: Filter<Document> = { ...live, is_empty: { $ne: true } };
  if (viewer.role !== "admin") match.visibility = { $ne: "private" };
  if (q) match.slug = { $regex: escapeRegex(q) };
  const [rows, total] = await Promise.all([
    col
      .find(match, { projection: LIST_PROJECTION })
      .sort({ updated_at: -1, slug: 1 })
      .skip(page * HOME_PAGE_SIZE)
      .limit(HOME_PAGE_SIZE)
      .toArray(),
    col.countDocuments(match),
  ]);
  return { rows: rows.map((r) => toSummary(r as ListRow)), total, pageSize: HOME_PAGE_SIZE };
}

/** Names only, for the command palette and quick search. */
export async function listSlugsFor(viewer: Viewer, limit = 2000) {
  const col = await documents();
  const match: Filter<Document> = { ...live, is_empty: { $ne: true } };
  if (viewer.role !== "admin") match.visibility = { $ne: "private" };
  const rows = await col
    .find(match, { projection: { _id: 0, slug: 1, updated_at: 1 } })
    .sort({ updated_at: -1 })
    .limit(limit)
    .toArray();
  return rows.map((r) => ({ slug: r.slug, updated_at: r.updated_at ?? null }));
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function getAdminStats(): Promise<AdminStats> {
  const col = await documents();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(today.getTime() - 29 * 86_400_000);
  const startIso = start.toISOString();

  const [facet] = await col
    .aggregate<{
      created: { _id: string; n: number }[];
      edited: { _id: string; n: number }[];
      total: { size: number }[];
      largest: { slug: string; size: number }[];
    }>([
      {
        $facet: {
          created: [
            { $match: { created_at: { $gte: startIso } } },
            { $group: { _id: { $substrBytes: ["$created_at", 0, 10] }, n: { $sum: 1 } } },
          ],
          edited: [
            { $match: { updated_at: { $gte: startIso } } },
            { $group: { _id: { $substrBytes: ["$updated_at", 0, 10] }, n: { $sum: 1 } } },
          ],
          total: [{ $group: { _id: null, size: { $sum: { $ifNull: ["$size", 0] } } } }],
          largest: [
            { $match: live },
            { $sort: { size: -1 } },
            { $limit: 5 },
            { $project: { _id: 0, slug: 1, size: { $ifNull: ["$size", 0] } } },
          ],
        },
      },
    ])
    .toArray();

  const created = new Map(facet.created.map((d) => [d._id, d.n]));
  const edited = new Map(facet.edited.map((d) => [d._id, d.n]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { date, created: created.get(date) ?? 0, edited: edited.get(date) ?? 0 };
  });

  return { days, largest: facet.largest, totalSize: facet.total[0]?.size ?? 0 };
}

const ATLAS_FREE_LIMIT = 512 * 1024 * 1024;

/** How much of the Atlas free tier is in use. The cluster figure needs listDatabases, which may be refused. */
export async function getStorageInfo(): Promise<StorageInfo> {
  const db = await connectToMongo();
  const [stats, cluster] = await Promise.all([
    db.command({ dbStats: 1 }).catch(() => null),
    db
      .admin()
      .listDatabases()
      .then((r) => Number(r.totalSize ?? 0) || null)
      .catch(() => null),
  ]);
  return {
    appBytes: stats ? Number(stats.storageSize ?? 0) + Number(stats.indexSize ?? 0) : 0,
    clusterBytes: cluster,
    limitBytes: ATLAS_FREE_LIMIT,
  };
}

export async function setReadOnlyMany(slugs: string[], readOnly: boolean) {
  const col = await documents();
  const res = await col.updateMany({ slug: { $in: slugs }, ...live }, { $set: { read_only: readOnly } });
  return res.modifiedCount;
}

export async function setVisibilityMany(slugs: string[], visibility: Visibility) {
  const col = await documents();
  const res = await col.updateMany({ slug: { $in: slugs }, ...live }, { $set: { visibility } });
  return res.matchedCount;
}

export function newShareToken(): string {
  return randomBytes(9).toString("base64url"); // 12 characters, 72 bits
}

/**
 * Turn on (or change) the share link of each note. Existing links keep their
 * token unless `regenerate` is set, so links already sent keep working.
 */
export async function setShareMany(
  slugs: string[],
  mode: ShareMode,
  { regenerate = false }: { regenerate?: boolean } = {},
): Promise<{ slug: string; token: string; mode: ShareMode }[]> {
  const col = await documents();
  const docs = await col
    .find({ slug: { $in: slugs }, ...live }, { projection: { slug: 1, share: 1 } })
    .toArray();
  const now = new Date().toISOString();
  const out = docs.map((d) => ({
    slug: d.slug,
    token: !regenerate && d.share?.token ? d.share.token : newShareToken(),
    mode,
    created_at: !regenerate && d.share?.created_at ? d.share.created_at : now,
  }));
  if (out.length) {
    await col.bulkWrite(
      out.map((o) => ({
        updateOne: {
          filter: { slug: o.slug },
          update: { $set: { share: { token: o.token, mode: o.mode, created_at: o.created_at } } },
        },
      })),
      { ordered: false },
    );
  }
  return out.map(({ slug, token, mode }) => ({ slug, token, mode }));
}

export async function removeShareMany(slugs: string[]) {
  const col = await documents();
  const res = await col.updateMany({ slug: { $in: slugs } }, { $unset: { share: "" } });
  return res.modifiedCount;
}

/** Move to the trash. MongoDB removes them for good after 30 days. */
export async function trashMany(slugs: string[], by: string) {
  const col = await documents();
  const res = await col.updateMany(
    { slug: { $in: slugs }, ...live },
    { $set: { deleted_at: new Date(), deleted_by: by } },
  );
  return res.modifiedCount;
}

export async function restoreFromTrash(slugs: string[]) {
  const col = await documents();
  const res = await col.updateMany(
    { slug: { $in: slugs }, deleted_at: { $exists: true } },
    { $unset: { deleted_at: "", deleted_by: "" } },
  );
  return res.modifiedCount;
}

/** Permanently delete notes that are already in the trash. */
export async function purgeMany(slugs: string[]) {
  const col = await documents();
  const res = await col.deleteMany({ slug: { $in: slugs }, deleted_at: { $exists: true } });
  return res.deletedCount;
}

export async function emptyTrash() {
  const col = await documents();
  const res = await col.deleteMany({ deleted_at: { $exists: true } });
  return res.deletedCount;
}

/** Deletes every empty, unlocked, unshared note outright (there's nothing in them to keep). */
export async function deleteAllEmpty() {
  const col = await documents();
  const res = await col.deleteMany({
    is_empty: true,
    read_only: { $ne: true },
    "share.token": { $exists: false },
    ...live,
  });
  return res.deletedCount;
}

export type RenameOutcome = { kind: "renamed" } | { kind: "taken" } | { kind: "missing" };

export async function renameDocument(from: string, to: string): Promise<RenameOutcome> {
  const col = await documents();
  if (await col.countDocuments({ slug: to }, { limit: 1 })) return { kind: "taken" };
  try {
    const res = await col.updateOne({ slug: from, ...live }, { $set: { slug: to } });
    return res.matchedCount ? { kind: "renamed" } : { kind: "missing" };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { kind: "taken" };
    throw err;
  }
}

/** Every note with its content, streamed as one JSON document, for backups. */
export async function exportAll(): Promise<ReadableStream<Uint8Array>> {
  const col = await documents();
  const cursor = col
    .find({}, { projection: { _id: 0, previous_content: 0 } })
    .sort({ slug: 1 });
  const enc = new TextEncoder();
  let first = true;
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(
        enc.encode(`{"app":"hrleaf","exported_at":${JSON.stringify(new Date().toISOString())},"notes":[\n`),
      );
    },
    async pull(controller) {
      const doc = await cursor.next();
      if (!doc) {
        controller.enqueue(enc.encode("\n]}\n"));
        controller.close();
        await cursor.close();
        return;
      }
      controller.enqueue(enc.encode((first ? "" : ",\n") + JSON.stringify(doc)));
      first = false;
    },
    async cancel() {
      await cursor.close();
    },
  });
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/**
 * What happens if this person opens /slug:
 * free (new note), open (an existing note they can see), or taken (exists but not for them).
 */
export async function slugStatus(slug: string, viewer: Viewer): Promise<"free" | "open" | "taken"> {
  const col = await documents();
  const doc = await col.findOne({ slug }, { projection: { _id: 0, visibility: 1, deleted_at: 1 } });
  if (!doc) return "free";
  if (doc.deleted_at) return "taken";
  if (doc.visibility === "private" && viewer.role !== "admin") return "taken";
  return "open";
}

/** Several unused random names, found with one query. */
export async function suggestAvailableSlugs(count: number): Promise<string[]> {
  const col = await documents();
  const candidates = [...new Set(Array.from({ length: count * 3 }, generateRandomSlug))].filter(
    (s) => s.length <= 40,
  );
  const taken = new Set(
    (await col.find({ slug: { $in: candidates } }, { projection: { slug: 1 } }).toArray()).map((d) => d.slug),
  );
  return candidates.filter((s) => !taken.has(s)).slice(0, count);
}

/**
 * `base` if nobody has it (including notes in the trash), else `base-2`, `base-3`...
 * Reserved route names always get a suffix.
 */
export async function nextFreeSlug(base: string): Promise<string> {
  const col = await documents();
  const taken = new Set(
    (
      await col
        .find({ slug: { $regex: `^${escapeRegex(base)}(-\\d+)?$` } }, { projection: { _id: 0, slug: 1 } })
        .toArray()
    ).map((d) => d.slug),
  );
  if (!taken.has(base) && !RESERVED_SLUGS.has(base)) return base;
  for (let n = 2; ; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }
}

/** Pick an unused random slug, checking several candidates in one query. */
export async function findAvailableSlug(): Promise<string> {
  const col = await documents();
  for (let round = 0; round < 3; round++) {
    const candidates = Array.from({ length: 8 }, generateRandomSlug);
    const taken = new Set(
      (
        await col
          .find({ slug: { $in: candidates } }, { projection: { slug: 1 } })
          .toArray()
      ).map((d) => d.slug),
    );
    const free = candidates.find((s) => !taken.has(s));
    if (free) return free;
  }
  return `${generateRandomSlug()}-${Date.now().toString(36)}`;
}
