import { ChevronLeft, ChevronRight, Globe, Lock, LockKeyhole } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

import { NewNoteButton } from "@/app/components/NewNoteDialog";
import SiteHeader from "@/app/components/SiteHeader";
import UserMenu from "@/app/components/UserMenu";
import { updatedAgo } from "@/lib/site";
import { requireViewer } from "@/server/auth";
import { listNotesFor } from "@/server/document-service";

import HomeSearch from "./HomeSearch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Notes" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: Props) {
  const viewer = await requireViewer("/");
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const q = one("q").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  const pageNum = Number.parseInt(one("page"), 10);
  const page = Number.isFinite(pageNum) && pageNum > 1 ? pageNum - 1 : 0;

  const { rows, total, pageSize } = await listNotesFor(viewer, q, page);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const isAdmin = viewer.role === "admin";
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 0) params.set("page", String(p + 1));
    const s = params.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <div className="flex min-h-[100svh] flex-col">
      <SiteHeader>
        <NewNoteButton label="New note" variant="primary" shortcut />
        <UserMenu viewer={viewer} className="ml-1" />
      </SiteHeader>

      <main className="mx-auto w-full max-w-[52rem] flex-1 px-3 pb-24 pt-8 sm:px-0 sm:pt-12">
        <div className="mb-6 flex flex-col gap-1.5 px-1">
          <h1 className="text-[1.75rem] font-semibold leading-none tracking-[-0.025em]">
            Notes
          </h1>
          <p className="tabular text-[13px] text-muted-foreground">
            {q ? `${total} note${total === 1 ? "" : "s"} matching “${q}”` : `${total} note${total === 1 ? "" : "s"}`}
            {isAdmin ? "" : " shared with your team"}
          </p>
        </div>

        <HomeSearch initial={q} />

        <ul className="panel mt-3 divide-y divide-border/70 overflow-clip">
          {rows.map((d) => (
            <li key={d.slug}>
              <Link
                href={`/${d.slug}`}
                className="group flex items-start gap-3 px-4 py-3 transition-colors duration-100 hover:bg-white/[0.025] focus-visible:bg-white/[0.04] focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-[13.5px] font-medium text-foreground">{d.slug}</span>
                    {isAdmin && d.visibility === "private" ? (
                      <Badge icon={<LockKeyhole className="h-3 w-3" aria-hidden />} label="Only me" />
                    ) : null}
                    {isAdmin && d.share ? (
                      <Badge icon={<Globe className="h-3 w-3" aria-hidden />} label={d.share.mode === "write" ? "Public · edit" : "Public"} tone="leaf" />
                    ) : null}
                    {d.read_only ? <Badge icon={<Lock className="h-3 w-3" aria-hidden />} label="Locked" /> : null}
                  </div>
                  <p className="mt-0.5 truncate text-[12.5px] text-[--text-tertiary]">{d.preview || "No text"}</p>
                </div>
                <div className="tabular shrink-0 pt-px text-right text-[12px] text-[--text-tertiary]">
                  <span className="block text-[--text-secondary]">{updatedAgo(d.updated_at) ?? "—"}</span>
                  {d.updated_by ? <span className="hidden sm:block">by {d.updated_by}</span> : null}
                </div>
              </Link>
            </li>
          ))}
          {rows.length === 0 ? (
            <li className="px-4 py-14 text-center">
              <p className="text-sm text-foreground">{q ? "No notes match." : "No notes yet."}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {q ? (
                  <>
                    Press Enter to create <span className="font-mono text-foreground">{q}</span>.
                  </>
                ) : (
                  "Create one with New note, or press N."
                )}
              </p>
            </li>
          ) : null}
        </ul>

        {pages > 1 ? (
          <nav aria-label="Pagination" className="tabular mt-4 flex items-center justify-between px-1 text-[12.5px] text-muted-foreground">
            <span>
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-1">
              <PageLink href={href(page - 1)} disabled={page === 0}>
                <ChevronLeft className="h-4 w-4" aria-hidden /> Newer
              </PageLink>
              <PageLink href={href(page + 1)} disabled={page >= pages - 1}>
                Older <ChevronRight className="h-4 w-4" aria-hidden />
              </PageLink>
            </div>
          </nav>
        ) : null}
      </main>
    </div>
  );
}

function Badge({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: "leaf" }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-[11px] ${
        tone === "leaf" ? "border-[--leaf]/35 text-[--leaf-strong]" : "border-border text-[--text-secondary]"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </span>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const cls = "flex h-7 items-center gap-1 rounded-md border border-border px-2 text-foreground transition-colors duration-150";
  return disabled ? (
    <span aria-disabled className={`${cls} opacity-40`}>
      {children}
    </span>
  ) : (
    <Link href={href} className={`${cls} hover:bg-accent`}>
      {children}
    </Link>
  );
}
