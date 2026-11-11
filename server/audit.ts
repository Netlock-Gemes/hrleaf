import "server-only";

import { ObjectId } from "mongodb";

import { AuditEntry } from "@/types";

import { AUDIT_COLLECTION_NAME, connectToMongo } from "./mongo-config";

type AuditDoc = {
  _id?: ObjectId;
  at: Date;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
  ip?: string;
};

async function col() {
  return (await connectToMongo()).collection<AuditDoc>(AUDIT_COLLECTION_NAME);
}

/**
 * Record something that happened. Never throws: a logging failure must not
 * break the action being logged. Entries expire automatically after 90 days.
 */
export async function audit(entry: Omit<AuditDoc, "at" | "_id">): Promise<void> {
  try {
    await (await col()).insertOne({ ...entry, at: new Date() });
  } catch (err) {
    console.error("[audit]", err);
  }
}

export const AUDIT_PAGE_SIZE = 100;

export async function listAudit(opts: { page: number; actor?: string }): Promise<{
  rows: AuditEntry[];
  total: number;
  actors: string[];
}> {
  const c = await col();
  const filter = opts.actor ? { actor: opts.actor } : {};
  const [rows, total, actors] = await Promise.all([
    c
      .find(filter)
      .sort({ at: -1 })
      .skip(opts.page * AUDIT_PAGE_SIZE)
      .limit(AUDIT_PAGE_SIZE)
      .toArray(),
    c.countDocuments(filter),
    c.distinct("actor"),
  ]);
  return {
    rows: rows.map((r) => ({
      id: String(r._id),
      at: r.at.toISOString(),
      actor: r.actor,
      action: r.action,
      target: r.target,
      detail: r.detail,
      ip: r.ip,
    })),
    total,
    actors: actors.sort(),
  };
}
