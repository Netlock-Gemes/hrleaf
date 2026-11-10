import "server-only";

import { AnyBulkWriteOperation, Collection, Db, MongoClient } from "mongodb";

import { Document } from "@/types";

import { derivedFields } from "./document-utils";

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "hrleaf";

export const DOCUMENTS_COLLECTION_NAME = "documents";

// Cache on globalThis so dev hot-reloads and concurrent requests share one pool.
const globalForMongo = globalThis as unknown as {
  _mongoDbPromise?: Promise<Db>;
};

/** One-time, idempotent: fill preview/size/is_empty for documents saved before they existed. */
async function backfillDerivedFields(db: Db) {
  const col = db.collection<Document>(DOCUMENTS_COLLECTION_NAME);
  const missing = await col
    .find({ is_empty: { $exists: false } }, { projection: { slug: 1, content: 1 } })
    .toArray();
  if (missing.length === 0) return;

  const ops: AnyBulkWriteOperation<Document>[] = missing.map((d) => ({
    updateOne: {
      filter: { _id: d._id },
      update: { $set: derivedFields(d.content ?? null) },
    },
  }));
  await col.bulkWrite(ops, { ordered: false });
  console.log(`[mongo] backfilled ${missing.length} documents`);
}

async function connect(): Promise<Db> {
  const client = new MongoClient(MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  const db = client.db(DB_NAME);

  await db
    .collection(DOCUMENTS_COLLECTION_NAME)
    .createIndexes([
      { key: { slug: 1 }, name: "slug_unique", unique: true },
      { key: { updated_at: -1 }, name: "updated_at_desc" },
      { key: { is_empty: 1, updated_at: -1 }, name: "is_empty_updated" },
    ])
    .catch((err) => console.error("[mongo] index creation failed:", err));

  await backfillDerivedFields(db).catch((err) =>
    console.error("[mongo] backfill failed:", err),
  );

  return db;
}

export function connectToMongo(): Promise<Db> {
  globalForMongo._mongoDbPromise ??= connect().catch((err) => {
    // Allow a retry on the next request instead of caching the failure.
    globalForMongo._mongoDbPromise = undefined;
    throw err;
  });
  return globalForMongo._mongoDbPromise;
}

export async function documents(): Promise<Collection<Document>> {
  return (await connectToMongo()).collection<Document>(DOCUMENTS_COLLECTION_NAME);
}
