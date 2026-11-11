"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_MAX_AGE,
  MEMBER_MAX_AGE,
  SESSION_COOKIE,
  adminSubject,
  createSessionToken,
  safeEqual,
} from "@/lib/session";

import { audit } from "./audit";
import { getViewer, safeNext } from "./auth";
import { MIN_PASSWORD_LENGTH, verifyPassword } from "./passwords";
import { clearFailedLogins, clientIp, loginRetryAfter, recordFailedLogin } from "./rate-limit";
import { getUserById, getUserByUsername, normaliseUsername, recordLogin, setPassword } from "./users-service";

export type LoginState = { error: string | null; username?: string };

async function setSessionCookie(token: string, maxAge: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!username || !password) return { error: "Enter your username and password.", username };

  const ip = await clientIp();
  const retryAfter = await loginRetryAfter(ip);
  if (retryAfter > 0) {
    const minutes = Math.ceil(retryAfter / 60);
    return {
      error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      username,
    };
  }

  const fail = async () => {
    await recordFailedLogin(ip);
    await audit({ actor: username.slice(0, 40) || "?", action: "sign-in failed", ip });
    await new Promise((r) => setTimeout(r, 400)); // slow down guessing a little more
    return { error: "That username and password don't match.", username };
  };

  // 1. The admin, from .env.
  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  if (adminUser && adminPass) {
    const [u, p] = await Promise.all([safeEqual(username, adminUser), safeEqual(password, adminPass)]);
    if (u) {
      if (!p) return fail();
      await clearFailedLogins(ip);
      await setSessionCookie(
        await createSessionToken({ sub: adminSubject(), role: "admin", ver: 0 }, ADMIN_MAX_AGE),
        ADMIN_MAX_AGE,
      );
      await audit({ actor: adminUser, action: "signed in", ip });
      redirect(next);
    }
  }

  // 2. Members, from the database. verifyPassword runs even when the user is missing,
  //    so a wrong username takes as long as a wrong password.
  const normalised = normaliseUsername(username);
  const user = normalised ? await getUserByUsername(normalised) : null;
  const ok = await verifyPassword(password, user?.password_hash);
  if (!user || !ok) return fail();
  if (user.disabled) {
    await audit({ actor: user.username, action: "sign-in blocked (account disabled)", ip });
    return { error: "This account is disabled. Ask the admin to turn it back on.", username };
  }

  await clearFailedLogins(ip);
  await recordLogin(user._id);
  await setSessionCookie(
    await createSessionToken({ sub: String(user._id), role: "member", ver: user.session_version }, MEMBER_MAX_AGE),
    MEMBER_MAX_AGE,
  );
  await audit({ actor: user.username, action: "signed in", ip });
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  const viewer = await getViewer();
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  if (viewer) await audit({ actor: viewer.username, action: "signed out" });
  redirect("/login");
}

export type PasswordChangeResult = { ok: true } | { ok: false; message: string };

/** Members change their own password. Signs out their other devices. */
export async function changePasswordAction(current: string, next: string): Promise<PasswordChangeResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: "Your session ended. Sign in again." };
  if (viewer.role === "admin") {
    return { ok: false, message: "The admin password is set in the server settings (ADMIN_PASSWORD)." };
  }
  if (typeof next !== "string" || next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (next.length > 200) return { ok: false, message: "That's too long." };

  const user = await getUserById(viewer.id);
  if (!user || !(await verifyPassword(String(current ?? ""), user.password_hash))) {
    return { ok: false, message: "Your current password isn't right." };
  }
  const updated = await setPassword(viewer.id, next);
  if (!updated) return { ok: false, message: "Couldn't update your password." };

  // Keep this device signed in with the new session version.
  await setSessionCookie(
    await createSessionToken({ sub: viewer.id, role: "member", ver: updated.session_version }, MEMBER_MAX_AGE),
    MEMBER_MAX_AGE,
  );
  await audit({ actor: viewer.username, action: "changed their password" });
  return { ok: true };
}
