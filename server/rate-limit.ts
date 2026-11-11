import "server-only";

import { headers } from "next/headers";

import { connectToMongo } from "./mongo-config";

/**
 * Login rate limiting, stored in MongoDB so it holds across serverless instances
 * (an in-memory counter would reset per Vercel function instance).
 *
 * - Per IP: 5 failed attempts per 15 minutes, then blocked for 15 minutes.
 * - Global: 50 failed attempts per 15 minutes across all IPs, which slows down
 *   distributed guessing without locking the admin out for long.
 */

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS = { ip: 5, global: 50 } as const;
const COLLECTION = "login_attempts";

type AttemptDoc = { _id: string; count: number; expires_at: Date };

let indexReady: Promise<unknown> | null = null;

async function collection() {
  const db = await connectToMongo();
  const col = db.collection<AttemptDoc>(COLLECTION);
  // MongoDB deletes records automatically once their window ends.
  indexReady ??= col
    .createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, name: "ttl" })
    .catch(() => (indexReady = null));
  await indexReady;
  return col;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Returns seconds until the caller may try again, or 0 if allowed. */
export async function loginRetryAfter(ip: string): Promise<number> {
  const col = await collection();
  const docs = await col.find({ _id: { $in: [`ip:${ip}`, "global"] } }).toArray();
  const now = Date.now();
  let wait = 0;
  for (const d of docs) {
    const limit = d._id === "global" ? LIMITS.global : LIMITS.ip;
    if (d.count >= limit) wait = Math.max(wait, d.expires_at.getTime() - now);
  }
  return Math.max(0, Math.ceil(wait / 1000));
}

export async function recordFailedLogin(ip: string): Promise<void> {
  const col = await collection();
  const now = new Date();
  const expires = new Date(now.getTime() + WINDOW_MS);
  await Promise.all(
    [`ip:${ip}`, "global"].map((key) =>
      col.updateOne(
        // Start a fresh window if the old one has expired but not been swept yet.
        { _id: key, expires_at: { $gt: now } },
        { $inc: { count: 1 } },
      ).then(async (r) => {
        if (r.matchedCount === 0) {
          await col.replaceOne({ _id: key }, { count: 1, expires_at: expires }, { upsert: true });
        } else {
          // Once over the limit, keep the block for a full window from the latest failure.
          const limit = key === "global" ? LIMITS.global : LIMITS.ip;
          await col.updateOne({ _id: key, count: { $gte: limit } }, { $set: { expires_at: expires } });
        }
      }),
    ),
  );
}

export async function clearFailedLogins(ip: string): Promise<void> {
  const col = await collection();
  await col.deleteOne({ _id: `ip:${ip}` });
}

/**
 * General-purpose fixed-window counter. Returns true while the caller is within
 * the limit. Used to slow down saves through public share links.
 */
export async function withinLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const col = await collection();
  const now = new Date();
  const res = await col.findOneAndUpdate(
    { _id: `rl:${key}`, expires_at: { $gt: now } },
    { $inc: { count: 1 } },
    { returnDocument: "after" },
  );
  if (res) return res.count <= limit;
  await col.replaceOne(
    { _id: `rl:${key}` },
    { count: 1, expires_at: new Date(now.getTime() + windowMs) },
    { upsert: true },
  );
  return true;
}
