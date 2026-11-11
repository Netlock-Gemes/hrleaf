import "server-only";

import { Filter } from "mongodb";
import { cache } from "react";

import {
  AdminListResult,
  AdminQuery,
  AdminStats,
  Document,
  DocumentSummary,
  EditorDocument,
} from "@/types";

import { derivedFields, escapeRegex, generateRandomSlug } from "./document-utils";
import { documents } from "./mongo-config";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024; // 2 MB of editor JSON
export const ADMIN_PAGE_SIZE = 50;

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** Wrapped in React cache so metadata + page share one query per request. */
export const getEditorDocument = cache(
  async (slug: string): Promise<EditorDocument | null> => {
    const col = await documents();
    const doc = await col.findOne(
      { slug },
      {
        projection: {
          _id: 0,
          slug: 1,
          content: 1,
          read_only: 1,
          updated_at: 1,
          previous_updated_at: 1,
        },
      },
    );
    if (!doc) return null;
    return {
      slug: doc.slug,
      content: doc.content ?? null,
      read_only: doc.read_only === true,
      updated_at: doc.updated_at ?? null,
      previous_updated_at: doc.previous_updated_at ?? null,
    };
  },
);

/* ------------------------------------------------------------------ */
/* Saving                                                              */
/* ------------------------------------------------------------------ */

export type SaveOutcome =
  | { kind: "saved"; updated_at: string | null; previous_updated_at: string | null }
  | { kind: "locked" }
  | { kind: "conflict"; server_updated_at: string | null };

/**
 * Save content in one atomic write.
 * - Keeps exactly one previous version (the content this save replaces).
 * - Refuses to touch locked documents.
 * - Detects conflicts: `baseUpdatedAt` must match what's stored, unless `force`.
 */
export async function saveDocumentContent(
  slug: string,
  content: object | null,
  baseUpdatedAt: string | null,
  force = false,
): Promise<SaveOutcome> {
  const derived = derivedFields(content);
  if (derived.size > MAX_CONTENT_BYTES) {
    throw new Error("Document is too large to save.");
  }
  const stored = derived.is_empty ? null : content;
  const col = await documents();
  const now = new Date().toISOString();

  const filter: Filter<Document> = { slug, read_only: { $ne: true } };
  if (!force) filter.updated_at = baseUpdatedAt ?? { $exists: false };

  // Never create a brand-new document just to store nothing.
  if (stored === null && baseUpdatedAt === null && !force) {
    const exists = await col.countDocuments({ slug }, { limit: 1 });
    if (!exists) return { kind: "saved", updated_at: null, previous_updated_at: null };
  }

  const hasCurrent = { $ne: [{ $ifNull: ["$content", null] }, null] };

  try {
    const result = await col.findOneAndUpdate(
      filter,
      [
        {
          $set: {
            previous_content: { $cond: [hasCurrent, "$content", "$previous_content"] },
            previous_updated_at: { $cond: [hasCurrent, "$updated_at", "$previous_updated_at"] },
            content: { $literal: stored },
            preview: { $literal: derived.preview },
            size: derived.size,
            is_empty: derived.is_empty,
            updated_at: now,
            read_only: { $ifNull: ["$read_only", false] },
            version: { $ifNull: ["$version", 1] },
            created_at: { $ifNull: ["$created_at", now] },
          },
        },
      ],
      {
        upsert: true,
        returnDocument: "after",
        projection: { previous_updated_at: 1 },
      },
    );
    return {
      kind: "saved",
      updated_at: now,
      previous_updated_at: result?.previous_updated_at ?? null,
    };
  } catch (err) {
    // Duplicate key: the slug exists but didn't match -> locked or changed elsewhere.
    if ((err as { code?: number }).code !== 11000) throw err;
    const current = await col.findOne(
      { slug },
      { projection: { read_only: 1, updated_at: 1 } },
    );
    if (current?.read_only) return { kind: "locked" };
    return { kind: "conflict", server_updated_at: current?.updated_at ?? null };
  }
}

export type RestoreOutcome =
  | { kind: "restored"; content: object | null; updated_at: string; previous_updated_at: string | null }
  | { kind: "none" }
  | { kind: "locked" }
  | { kind: "conflict" };

/**
 * Swap the current content with the single previous version.
 * Running it twice puts things back, so a restore is always undoable.
 */
export async function restorePreviousVersion(
  slug: string,
  { asAdmin = false, baseUpdatedAt }: { asAdmin?: boolean; baseUpdatedAt?: string | null } = {},
): Promise<RestoreOutcome> {
  const col = await documents();
  const doc = await col.findOne(
    { slug },
    {
      projection: {
        content: 1,
        updated_at: 1,
        read_only: 1,
        previous_content: 1,
        previous_updated_at: 1,
      },
    },
  );
  if (!doc || doc.previous_content === undefined || doc.previous_content === null) {
    return { kind: "none" };
  }
  if (doc.read_only && !asAdmin) return { kind: "locked" };
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
        ...derivedFields(restored),
      },
    },
  );
  if (res.matchedCount === 0) return { kind: "conflict" };
  return {
    kind: "restored",
    content: restored,
    updated_at: now,
    previous_updated_at: doc.updated_at ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export async function listDocuments(query: AdminQuery): Promise<AdminListResult> {
  const col = await documents();

  const base: Filter<Document> = query.q
    ? { slug: { $regex: escapeRegex(query.q) } }
    : {};
  const match: Filter<Document> = { ...base };
  if (query.filter === "locked") match.read_only = true;
  if (query.filter === "empty") match.is_empty = true;

  const sortField = query.sort;
  const dir = query.desc ? -1 : 1;

  const [rows, countsAgg] = await Promise.all([
    col
      .find(match, {
        projection: {
          _id: 0,
          slug: 1,
          read_only: 1,
          created_at: 1,
          updated_at: 1,
          preview: 1,
          size: 1,
          is_empty: 1,
          has_previous: { $ne: [{ $ifNull: ["$previous_content", null] }, null] },
        },
      })
      .sort({ [sortField]: dir, slug: 1 })
      .skip(query.page * ADMIN_PAGE_SIZE)
      .limit(ADMIN_PAGE_SIZE)
      .toArray(),
    col
      .aggregate<{ all: number; locked: number; empty: number }>([
        { $match: base },
        {
          $group: {
            _id: null,
            all: { $sum: 1 },
            locked: { $sum: { $cond: [{ $eq: ["$read_only", true] }, 1, 0] } },
            empty: { $sum: { $cond: [{ $eq: ["$is_empty", true] }, 1, 0] } },
          },
        },
      ])
      .toArray(),
  ]);

  const counts = countsAgg[0] ?? { all: 0, locked: 0, empty: 0 };
  return {
    rows: rows.map((r) => ({
      slug: r.slug,
      read_only: r.read_only === true,
      created_at: r.created_at,
      updated_at: r.updated_at,
      preview: r.preview ?? "",
      size: r.size ?? 0,
      is_empty: r.is_empty === true,
      has_previous: (r as unknown as DocumentSummary).has_previous === true,
    })),
    total: counts[query.filter],
    counts: { all: counts.all, locked: counts.locked, empty: counts.empty },
    pageSize: ADMIN_PAGE_SIZE,
  };
}

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

  return {
    days,
    largest: facet.largest,
    totalSize: facet.total[0]?.size ?? 0,
  };
}

export async function setReadOnlyMany(slugs: string[], readOnly: boolean) {
  const col = await documents();
  const res = await col.updateMany({ slug: { $in: slugs } }, { $set: { read_only: readOnly } });
  return res.modifiedCount;
}

export async function deleteMany(slugs: string[]) {
  const col = await documents();
  const res = await col.deleteMany({ slug: { $in: slugs } });
  return res.deletedCount;
}

/** Deletes every empty, unlocked document. */
export async function deleteAllEmpty() {
  const col = await documents();
  const res = await col.deleteMany({ is_empty: true, read_only: { $ne: true } });
  return res.deletedCount;
}

export type RenameOutcome = { kind: "renamed" } | { kind: "taken" } | { kind: "missing" };

export async function renameDocument(from: string, to: string): Promise<RenameOutcome> {
  const col = await documents();
  if (await col.countDocuments({ slug: to }, { limit: 1 })) return { kind: "taken" };
  try {
    const res = await col.updateOne({ slug: from }, { $set: { slug: to } });
    return res.matchedCount ? { kind: "renamed" } : { kind: "missing" };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { kind: "taken" };
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

/** Does a note with this slug exist? */
export async function slugExists(slug: string): Promise<boolean> {
  const col = await documents();
  return (await col.countDocuments({ slug }, { limit: 1 })) > 0;
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
