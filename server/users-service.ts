import "server-only";

import { ObjectId } from "mongodb";
import { cache } from "react";

import { UserSummary } from "@/types";

import { USERS_COLLECTION_NAME, connectToMongo } from "./mongo-config";
import { hashPassword } from "./passwords";

export type UserDoc = {
  _id: ObjectId;
  username: string;
  name: string;
  password_hash: string;
  disabled: boolean;
  /** Bumped to sign the user out everywhere (disable, password reset, "sign out everywhere"). */
  session_version: number;
  created_at: Date;
  last_login_at?: Date;
};

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/;

export function normaliseUsername(input: string): string | null {
  const u = String(input ?? "").trim().toLowerCase();
  return USERNAME_PATTERN.test(u) ? u : null;
}

async function col() {
  return (await connectToMongo()).collection<UserDoc>(USERS_COLLECTION_NAME);
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id ? new ObjectId(id) : null;
}

/** One lookup per request, shared by every auth check in that request. */
export const getUserById = cache(async (id: string): Promise<UserDoc | null> => {
  const _id = toObjectId(id);
  if (!_id) return null;
  return (await col()).findOne({ _id });
});

export async function getUserByUsername(username: string): Promise<UserDoc | null> {
  return (await col()).findOne({ username });
}

export async function listUsers(): Promise<UserSummary[]> {
  const rows = await (await col())
    .find({}, { projection: { password_hash: 0 } })
    .sort({ created_at: 1 })
    .toArray();
  return rows.map((u) => ({
    id: String(u._id),
    username: u.username,
    name: u.name,
    disabled: u.disabled === true,
    created_at: u.created_at.toISOString(),
    last_login_at: u.last_login_at?.toISOString() ?? null,
  }));
}

export async function createUser(username: string, name: string, password: string) {
  try {
    const res = await (await col()).insertOne({
      _id: new ObjectId(),
      username,
      name,
      password_hash: await hashPassword(password),
      disabled: false,
      session_version: 1,
      created_at: new Date(),
    });
    return { kind: "created" as const, id: String(res.insertedId) };
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { kind: "taken" as const };
    throw err;
  }
}

export async function setPassword(id: string, password: string) {
  const _id = toObjectId(id);
  if (!_id) return null;
  return (await col()).findOneAndUpdate(
    { _id },
    { $set: { password_hash: await hashPassword(password) }, $inc: { session_version: 1 } },
    { returnDocument: "after" },
  );
}

export async function updateUser(id: string, patch: { name?: string; disabled?: boolean }) {
  const _id = toObjectId(id);
  if (!_id) return null;
  const update: Record<string, unknown> = { $set: patch };
  // Disabling also ends any open sessions.
  if (patch.disabled) update.$inc = { session_version: 1 };
  return (await col()).findOneAndUpdate({ _id }, update, { returnDocument: "after" });
}

export async function signOutEverywhere(id: string) {
  const _id = toObjectId(id);
  if (!_id) return null;
  return (await col()).findOneAndUpdate({ _id }, { $inc: { session_version: 1 } }, { returnDocument: "after" });
}

export async function deleteUser(id: string) {
  const _id = toObjectId(id);
  if (!_id) return null;
  return (await col()).findOneAndDelete({ _id });
}

export async function recordLogin(id: ObjectId) {
  await (await col()).updateOne({ _id: id }, { $set: { last_login_at: new Date() } });
}
