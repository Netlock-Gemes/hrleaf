"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { ShareMode, Viewer, Visibility } from "@/types";

import { audit } from "./audit";
import { getViewer } from "./auth";
import {
  deleteAllEmpty,
  emptyTrash,
  purgeMany,
  removeShareMany,
  renameDocument,
  restoreFromTrash,
  restorePreviousVersion,
  setReadOnlyMany,
  setShareMany,
  setVisibilityMany,
  trashMany,
} from "./document-service";
import { RESERVED_SLUGS, normaliseSlug } from "./document-utils";
import { MIN_PASSWORD_LENGTH, generatePassword } from "./passwords";
import {
  createUser,
  deleteUser,
  normaliseUsername,
  setPassword,
  signOutEverywhere,
  updateUser,
} from "./users-service";

export type AdminActionResult = { ok: true; message: string } | { ok: false; message: string };

function cleanSlugs(slugs: unknown): string[] {
  if (!Array.isArray(slugs)) return [];
  return [...new Set(slugs.map((s) => normaliseSlug(String(s))).filter((s): s is string => !!s))].slice(0, 500);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const names = (list: string[]) => (list.length <= 3 ? list.join(", ") : `${list.slice(0, 3).join(", ")} +${list.length - 3}`);

/**
 * Options the caller can pass. `refresh: false` skips re-rendering the admin
 * pages inside the action's response: dialogs that update their own state use
 * it so a click doesn't wait for the whole admin page (list, stats, storage) to
 * be rebuilt. They refresh once in the background instead.
 */
export type ActionOptions = { refresh?: boolean };

/** Every admin action: check the caller, run, refresh admin pages, never leak server errors. */
async function guarded<T extends { ok: boolean; message: string }>(
  fn: (admin: Viewer) => Promise<T>,
  opts: ActionOptions = {},
): Promise<T | AdminActionResult> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return { ok: false, message: "Not allowed." };
  try {
    const res = await fn(viewer);
    if (opts.refresh !== false) revalidatePath("/ainzooalgown", "layout");
    return res;
  } catch (err) {
    console.error("[admin]", err);
    return { ok: false, message: "Something went wrong on the server. Try again." };
  }
}

/** Write the activity log after the response is sent, so the click doesn't wait for it. */
function logLater(entry: Parameters<typeof audit>[0]) {
  after(() => audit(entry));
}

/* --------------------------------- notes --------------------------------- */

export async function setLockedAction(slugs: string[], locked: boolean, opts?: ActionOptions) {
  return guarded(async (admin) => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    await setReadOnlyMany(list, locked);
    logLater({ actor: admin.username, action: locked ? "locked" : "unlocked", target: names(list) });
    const verb = locked ? "Locked" : "Unlocked";
    return { ok: true, message: list.length === 1 ? `${verb} ${list[0]}` : `${verb} ${plural(list.length, "note")}` };
  }, opts);
}

export async function setVisibilityAction(slugs: string[], visibility: Visibility, opts?: ActionOptions) {
  return guarded(async (admin) => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    if (visibility !== "team" && visibility !== "private") return { ok: false, message: "Invalid choice." };
    await setVisibilityMany(list, visibility);
    logLater({
      actor: admin.username,
      action: visibility === "private" ? "made only-me" : "made visible to team",
      target: names(list),
    });
    const what = visibility === "private" ? "Only you can see" : "Your team can see";
    return { ok: true, message: list.length === 1 ? `${what} ${list[0]}` : `${what} ${plural(list.length, "note")}` };
  }, opts);
}

export type ShareActionResult =
  | { ok: true; message: string; links: { slug: string; token: string; mode: ShareMode }[] }
  | { ok: false; message: string };

export async function setShareAction(
  slugs: string[],
  mode: ShareMode,
  opts: { regenerate?: boolean } & ActionOptions = {},
): Promise<ShareActionResult> {
  return guarded<ShareActionResult>(async (admin) => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    if (mode !== "read" && mode !== "write") return { ok: false, message: "Invalid choice." };
    const links = await setShareMany(list, mode, { regenerate: opts.regenerate === true });
    if (!links.length) return { ok: false, message: "Those notes no longer exist." };
    logLater({
      actor: admin.username,
      action: opts.regenerate
        ? "replaced the share link"
        : mode === "write"
          ? "shared (can edit)"
          : "shared (read only)",
      target: names(links.map((l) => l.slug)),
    });
    return {
      ok: true,
      message: opts.regenerate
        ? "New link created. The old one no longer works."
        : links.length === 1
          ? `Anyone with the link can ${mode === "write" ? "edit" : "read"} ${links[0].slug}`
          : `Created ${plural(links.length, "link")}`,
      links,
    };
  }, opts) as Promise<ShareActionResult>;
}

export async function removeShareAction(slugs: string[], opts?: ActionOptions) {
  return guarded(async (admin) => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    await removeShareMany(list);
    logLater({ actor: admin.username, action: "turned off the share link", target: names(list) });
    return {
      ok: true,
      message: list.length === 1 ? `The share link for ${list[0]} no longer works` : `Turned off ${plural(list.length, "link")}`,
    };
  }, opts);
}

export async function deleteDocumentsAction(slugs: string[], opts?: ActionOptions) {
  return guarded(async (admin) => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    const n = await trashMany(list, admin.username);
    logLater({ actor: admin.username, action: "moved to trash", target: names(list) });
    return {
      ok: true,
      message: list.length === 1 ? `Moved ${list[0]} to the trash` : `Moved ${plural(n, "note")} to the trash`,
    };
  }, opts);
}

export async function restoreFromTrashAction(slugs: string[]) {
  return guarded(async (admin) => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    const n = await restoreFromTrash(list);
    logLater({ actor: admin.username, action: "restored from trash", target: names(list) });
    return { ok: true, message: list.length === 1 ? `Restored ${list[0]}` : `Restored ${plural(n, "note")}` };
  });
}

export async function purgeDocumentsAction(slugs: string[]) {
  return guarded(async (admin) => {
    const list = cleanSlugs(slugs);
    if (!list.length) return { ok: false, message: "Nothing selected." };
    const n = await purgeMany(list);
    logLater({ actor: admin.username, action: "deleted forever", target: names(list) });
    return { ok: true, message: `Deleted ${plural(n, "note")} forever` };
  });
}

export async function emptyTrashAction() {
  return guarded(async (admin) => {
    const n = await emptyTrash();
    logLater({ actor: admin.username, action: "emptied the trash", detail: plural(n, "note") });
    return { ok: true, message: n ? `Deleted ${plural(n, "note")} forever` : "The trash was already empty." };
  });
}

export async function deleteAllEmptyAction() {
  return guarded(async (admin) => {
    const n = await deleteAllEmpty();
    if (n) logLater({ actor: admin.username, action: "deleted empty notes", detail: plural(n, "note") });
    return { ok: true, message: n ? `Deleted ${plural(n, "empty note")}` : "There were no empty notes." };
  });
}

export async function renameDocumentAction(from: string, to: string) {
  return guarded(async (admin) => {
    const a = normaliseSlug(from);
    const b = normaliseSlug(to);
    if (!a) return { ok: false, message: "Invalid note." };
    if (!b) return { ok: false, message: "Use lowercase letters, numbers and dashes (up to 64)." };
    if (a === b) return { ok: false, message: "That's already its name." };
    if (RESERVED_SLUGS.has(b)) return { ok: false, message: "That name is reserved." };
    const out = await renameDocument(a, b);
    if (out.kind === "taken") return { ok: false, message: `${b} is already taken.` };
    if (out.kind === "missing") return { ok: false, message: `${a} no longer exists.` };
    logLater({ actor: admin.username, action: "renamed", target: b, detail: `from ${a}` });
    return { ok: true, message: `Renamed to ${b}` };
  });
}

export async function restorePreviousAction(slug: string) {
  return guarded(async (admin) => {
    const s = normaliseSlug(slug);
    if (!s) return { ok: false, message: "Invalid note." };
    const out = await restorePreviousVersion(s, { viewer: admin });
    if (out.kind === "none") return { ok: false, message: "There's no previous version." };
    if (out.kind !== "restored") return { ok: false, message: "It changed meanwhile. Try again." };
    logLater({ actor: admin.username, action: "restored the previous version", target: s });
    return { ok: true, message: `Restored the previous version of ${s}` };
  });
}

/* --------------------------------- users --------------------------------- */

export type CredentialsResult =
  | { ok: true; message: string; username: string; password: string }
  | { ok: false; message: string };

function cleanName(name: unknown) {
  return String(name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
}

function checkPassword(pw: string | undefined): string | null {
  if (pw === undefined || pw === "") return null;
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (pw.length > 200) return "That password is too long.";
  return null;
}

export async function createUserAction(input: {
  username: string;
  name: string;
  password?: string;
}): Promise<CredentialsResult> {
  return guarded<CredentialsResult>(async (admin) => {
    const username = normaliseUsername(input.username);
    if (!username) {
      return { ok: false, message: "Usernames are 2–32 characters: lowercase letters, numbers, dots, dashes or underscores." };
    }
    if (username === (process.env.ADMIN_USERNAME ?? "").toLowerCase()) {
      return { ok: false, message: "That's the admin's username." };
    }
    const pwError = checkPassword(input.password);
    if (pwError) return { ok: false, message: pwError };
    const password = input.password || generatePassword();
    const name = cleanName(input.name) || username;

    const out = await createUser(username, name, password);
    if (out.kind === "taken") return { ok: false, message: `${username} is already taken.` };
    logLater({ actor: admin.username, action: "added user", target: username });
    return { ok: true, message: `Added ${username}`, username, password };
  }) as Promise<CredentialsResult>;
}

export async function resetPasswordAction(id: string, password?: string): Promise<CredentialsResult> {
  return guarded<CredentialsResult>(async (admin) => {
    const pwError = checkPassword(password);
    if (pwError) return { ok: false, message: pwError };
    const pw = password || generatePassword();
    const user = await setPassword(String(id), pw);
    if (!user) return { ok: false, message: "That user no longer exists." };
    logLater({ actor: admin.username, action: "reset password", target: user.username });
    return { ok: true, message: `New password for ${user.username}. They've been signed out everywhere.`, username: user.username, password: pw };
  }) as Promise<CredentialsResult>;
}

export async function updateUserAction(id: string, patch: { name?: string; disabled?: boolean }) {
  return guarded(async (admin) => {
    const clean: { name?: string; disabled?: boolean } = {};
    if (patch.name !== undefined) {
      clean.name = cleanName(patch.name);
      if (!clean.name) return { ok: false, message: "Enter a name." };
    }
    if (patch.disabled !== undefined) clean.disabled = patch.disabled === true;
    const user = await updateUser(String(id), clean);
    if (!user) return { ok: false, message: "That user no longer exists." };
    if (clean.disabled !== undefined) {
      logLater({ actor: admin.username, action: clean.disabled ? "disabled user" : "enabled user", target: user.username });
      return {
        ok: true,
        message: clean.disabled ? `${user.username} is disabled and signed out` : `${user.username} can sign in again`,
      };
    }
    logLater({ actor: admin.username, action: "renamed user", target: user.username, detail: clean.name });
    return { ok: true, message: "Saved" };
  });
}

export async function signOutUserAction(id: string) {
  return guarded(async (admin) => {
    const user = await signOutEverywhere(String(id));
    if (!user) return { ok: false, message: "That user no longer exists." };
    logLater({ actor: admin.username, action: "signed out user everywhere", target: user.username });
    return { ok: true, message: `${user.username} is signed out on every device` };
  });
}

export async function deleteUserAction(id: string) {
  return guarded(async (admin) => {
    const user = await deleteUser(String(id));
    if (!user) return { ok: false, message: "That user no longer exists." };
    logLater({ actor: admin.username, action: "deleted user", target: user.username });
    return { ok: true, message: `Deleted ${user.username}. Their notes stay.` };
  });
}
