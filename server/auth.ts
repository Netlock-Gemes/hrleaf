import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { safeNext } from "@/lib/safe-next";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { Viewer } from "@/types";

import { getUserById } from "./users-service";

/**
 * Who is making this request, or null when signed out.
 * Members are re-checked against the database every request, so a disabled
 * account or a reset password takes effect immediately.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const store = await cookies();
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  if (session.role === "admin") {
    const username = process.env.ADMIN_USERNAME ?? "admin";
    return { id: "admin", role: "admin", username, name: username };
  }

  const user = await getUserById(session.sub).catch(() => null);
  if (!user || user.disabled || user.session_version !== session.ver) return null;
  return { id: String(user._id), role: "member", username: user.username, name: user.name || user.username };
});

export async function isAdmin(): Promise<boolean> {
  return (await getViewer())?.role === "admin";
}

export { safeNext };

/** Pages that need any signed-in person. */
export async function requireViewer(next: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return viewer;
}

/**
 * Admin pages. Everyone else gets a plain 404, so the admin area
 * doesn't advertise that it exists.
 */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") notFound();
  return viewer;
}
