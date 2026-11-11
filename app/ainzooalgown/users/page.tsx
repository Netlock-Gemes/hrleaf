import { Metadata } from "next";

import { requireAdmin } from "@/server/auth";
import { listUsers } from "@/server/users-service";

import UsersPanel from "./UsersPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const admin = await requireAdmin();
  const users = await listUsers();
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-6 sm:px-6 sm:pt-10">
      <UsersPanel users={users} adminName={admin.username} now={Date.now()} />
    </main>
  );
}
