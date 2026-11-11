import { Metadata } from "next";

import { NewNoteButton } from "@/app/components/NewNoteDialog";
import { requireAdmin } from "@/server/admin-auth";
import { getAdminStats, listDocuments } from "@/server/document-service";
import { AdminFilter, AdminQuery, AdminSortKey } from "@/types";

import SiteHeader from "../components/SiteHeader";

import AccountMenu from "./AccountMenu";
import ActivityPanel from "./ActivityPanel";
import DocumentsTable from "./DocumentsTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Documents · HRLeaf admin",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS: AdminFilter[] = ["all", "locked", "empty"];
const SORTS: AdminSortKey[] = ["slug", "size", "created_at", "updated_at"];

function parseQuery(sp: Record<string, string | string[] | undefined>): AdminQuery {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const filter = one("filter") as AdminFilter;
  const sort = one("sort") as AdminSortKey;
  const page = Number.parseInt(one("page"), 10);
  return {
    q: one("q").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64),
    filter: FILTERS.includes(filter) ? filter : "all",
    sort: SORTS.includes(sort) ? sort : "updated_at",
    desc: one("dir") !== "asc",
    page: Number.isFinite(page) && page > 0 ? page - 1 : 0,
  };
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const query = parseQuery(await searchParams);
  const [list, stats] = await Promise.all([listDocuments(query), getAdminStats()]);

  return (
    <div className="flex min-h-[100svh] flex-col">
      <SiteHeader
        wide
        homeHref="/ainzooalgown"
        trail={<span className="text-[13px] text-muted-foreground">Admin</span>}
      >
        <AccountMenu username={process.env.ADMIN_USERNAME ?? "admin"} />
      </SiteHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-[1.75rem] font-semibold leading-none tracking-[-0.025em]">Documents</h1>
            <p className="tabular text-[13px] text-muted-foreground">
              {list.counts.all} notes · {list.counts.locked} locked · {list.counts.empty} empty
              {query.q ? ` matching “${query.q}”` : ""}
            </p>
          </div>
          <NewNoteButton label="New note" variant="primary" shortcut />
        </div>
        {/* On phones the list comes first; the overview follows it. */}
        <div className="flex flex-col gap-6 lg:gap-8">
          <div className="order-2 lg:order-1">
            <ActivityPanel stats={stats} />
          </div>
          <div className="order-1 lg:order-2">
            <DocumentsTable list={list} query={query} now={Date.now()} />
          </div>
        </div>
      </main>
    </div>
  );
}
