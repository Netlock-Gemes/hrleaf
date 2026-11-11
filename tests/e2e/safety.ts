import { readFileSync } from "node:fs";

import { MongoClient } from "mongodb";

/** Load .env for local runs (CI passes real environment variables). */
export function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (!m || process.env[m[1]] !== undefined) continue;
      // Same quoting rules as Next.js: surrounding quotes are not part of the value.
      const raw = m[2].trim();
      const quoted = /^(["'])(.*)\1$/.exec(raw);
      process.env[m[1]] = quoted ? quoted[2] : raw;
    }
  } catch {
    /* no .env: rely on the environment */
  }
}

/** Only run against test databases, never the real notes. */
export function assertTestDatabase() {
  const db = process.env.MONGODB_DB ?? "hrleaf";
  if (!/(_dev|_ci|_test|-test)$/.test(db) && process.env.E2E_ALLOW_ANY_DB !== "1") {
    throw new Error(
      `Refusing to run end-to-end tests against database "${db}". Point MONGODB_DB at a test copy (name ending in _dev, _ci or _test).`,
    );
  }
  return db;
}

export const PREFIX = "zz-e2e-";

export async function cleanTestData() {
  loadEnv();
  const name = assertTestDatabase();
  const client = new MongoClient(process.env.MONGODB_URI ?? "mongodb://localhost:27017");
  await client.connect();
  const db = client.db(name);
  const re = new RegExp(`^${PREFIX}`);
  await Promise.all([
    db.collection("documents").deleteMany({ slug: re }),
    db.collection("users").deleteMany({ username: re }),
    db.collection("audit_log").deleteMany({ $or: [{ actor: re }, { target: re }] }),
    db.collection("login_attempts").deleteMany({}),
  ]);
  await client.close();
}
