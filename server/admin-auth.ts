import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return (await verifySessionToken(store.get(SESSION_COOKIE)?.value)) !== null;
}

/** Guard for admin pages and admin server actions. Middleware is not enough on its own. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/ainzooalgown/login");
}
