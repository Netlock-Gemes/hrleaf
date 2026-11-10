"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  safeEqual,
} from "@/lib/session";

import { requireAdmin } from "./admin-auth";
import {
  deleteAllEmpty,
  deleteMany,
  renameDocument,
  restorePreviousVersion,
  setReadOnlyMany,
} from "./document-service";
import { normaliseSlug } from "./document-utils";
import { clearFailedLogins, clientIp, loginRetryAfter, recordFailedLogin } from "./rate-limit";

export type LoginState = { error: string | null; username?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) {
    return {
      error: "Admin login is not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in .env.",
      username,
    };
  }

  const ip = await clientIp();
  const retryAfter = await loginRetryAfter(ip);
  if (retryAfter > 0) {
    const minutes = Math.ceil(retryAfter / 60);
    return {
      error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      username,
    };
  }

  const [userOk, passOk] = await Promise.all([
    safeEqual(username, expectedUser),
    safeEqual(password, expectedPass),
  ]);

  if (!userOk || !passOk) {
    await recordFailedLogin(ip);
    // Small fixed delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "That username and password don't match.", username };
  }

  await clearFailedLogins(ip);

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(expectedUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect("/ainzooalgown");
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/ainzooalgown/login");
}

/* ---------------------------- document admin ---------------------------- */

export type AdminActionResult = { ok: true; message: string } | { ok: false; message: string };

function cleanSlugs(slugs: unknown): string[] {
  if (!Array.isArray(slugs)) return [];
  return [...new Set(slugs.map((s) => normaliseSlug(String(s))).filter((s): s is string => !!s))].slice(0, 500);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

async function guarded(fn: () => Promise<AdminActionResult>): Promise<AdminActionResult> {
  await requireAdmin();
  try {
    const res = await fn();
    revalidatePath("/ainzooalgown");
    return res;
  } catch (err) {
    console.error("[admin]", err);
    return { ok: false, message: "Something went wrong on the server. Try again." };
  }
}

export async function setLockedAction(slugs: string[], locked: boolean) {
  return guarded(async () => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    await setReadOnlyMany(list, locked);
    return {
      ok: true,
      message: list.length === 1 ? `${locked ? "Locked" : "Unlocked"} ${list[0]}` : `${locked ? "Locked" : "Unlocked"} ${plural(list.length, "note")}`,
    };
  });
}

export async function deleteDocumentsAction(slugs: string[]) {
  return guarded(async () => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    const n = await deleteMany(list);
    return { ok: true, message: list.length === 1 ? `Deleted ${list[0]}` : `Deleted ${plural(n, "note")}` };
  });
}

export async function deleteAllEmptyAction() {
  return guarded(async () => {
    const n = await deleteAllEmpty();
    return { ok: true, message: n ? `Deleted ${plural(n, "empty note")}` : "There were no empty notes." };
  });
}

export async function renameDocumentAction(from: string, to: string) {
  return guarded(async () => {
    const a = normaliseSlug(from);
    const b = normaliseSlug(to);
    if (!a) return { ok: false, message: "Invalid note." };
    if (!b) return { ok: false, message: "Use lowercase letters, numbers and dashes (up to 64)." };
    if (a === b) return { ok: false, message: "That's already its name." };
    if (["ainzooalgown", "privacy", "api", "robots.txt"].includes(b)) {
      return { ok: false, message: "That name is reserved." };
    }
    const out = await renameDocument(a, b);
    if (out.kind === "taken") return { ok: false, message: `${b} is already taken.` };
    if (out.kind === "missing") return { ok: false, message: `${a} no longer exists.` };
    return { ok: true, message: `Renamed to ${b}` };
  });
}

export async function restorePreviousAction(slug: string) {
  return guarded(async () => {
    const s = normaliseSlug(slug);
    if (!s) return { ok: false, message: "Invalid note." };
    const out = await restorePreviousVersion(s, { asAdmin: true });
    if (out.kind === "none") return { ok: false, message: "There's no previous version." };
    if (out.kind !== "restored") return { ok: false, message: "It changed meanwhile. Try again." };
    return { ok: true, message: `Restored the previous version of ${s}` };
  });
}
