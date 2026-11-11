import { ChevronLeft, ChevronRight } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

import { Avatar } from "@/app/components/UserMenu";
import { updatedAgo } from "@/lib/site";
import { AUDIT_PAGE_SIZE, listAudit } from "@/server/audit";
import { requireAdmin } from "@/server/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Activity" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/** Things that matter for security get a warning tone. */
const isAlert = (action: string) => /failed|blocked|disabled user|deleted forever|emptied/.test(action);

/** Only link targets that are a single note name. */
const noteTarget = (t?: string) => (t && /^[a-z0-9][a-z0-9-]{0,63}$/.test(t) ? t : null);

export default async function ActivityPage({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const actor = one("who").slice(0, 40);
  const pageNum = Number.parseInt(one("page"), 10);
  const page = Number.isFinite(pageNum) && pageNum > 1 ? pageNum - 1 : 0;

  const { rows, total, actors } = await listAudit({ page, actor: actor || undefined });
  const pages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));
  const href = (p: number, who = actor) => {
    const q = new URLSearchParams();
    if (who) q.set("who", who);
    if (p > 0) q.set("page", String(p + 1));
    const s = q.toString();
    return `/ainzooalgown/activity${s ? `?${s}` : ""}`;
  };

  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-6 sm:px-6 sm:pt-10">
      <div className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-[1.75rem] font-semibold leading-none tracking-[-0.025em]">Activity</h1>
        <p className="tabular text-[13px] text-muted-foreground">
          Sign-ins, sharing and admin changes. Kept for 90 days. Times in UTC.
        </p>
      </div>

      {actors.length > 1 ? (
        <nav aria-label="Filter by person" className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {["", ...actors].map((a) => (
            <Link
              key={a || "all"}
              href={href(0, a)}
              aria-current={a === actor ? "page" : undefined}
              className={`flex h-8 shrink-0 items-center rounded-full border px-3 text-[12.5px] transition-colors duration-150 ${
                a === actor
                  ? "border-[--leaf]/50 bg-[--primary-10] text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {a || "Everyone"}
            </Link>
          ))}
        </nav>
      ) : null}

      <ol className="panel divide-y divide-border/70 overflow-clip">
        {rows.map((r) => {
          const target = noteTarget(r.target);
          return (
            <li key={r.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar name={r.actor} size={28} />
              <div className="min-w-0 flex-1 text-[13px] leading-5">
                <p className="text-[--text-secondary]">
                  <span className="font-medium text-foreground">{r.actor}</span>{" "}
                  <span className={isAlert(r.action) ? "text-[--danger-text]" : undefined}>{r.action}</span>
                  {r.target ? (
                    <>
                      {" "}
                      {target ? (
                        <Link href={`/${target}`} className="font-mono text-foreground underline-offset-4 hover:underline">
                          {target}
                        </Link>
                      ) : (
                        <span className="font-mono text-foreground">{r.target}</span>
                      )}
                    </>
                  ) : null}
                  {r.detail ? <span className="text-[--text-tertiary]"> · {r.detail}</span> : null}
                </p>
                {r.ip ? <p className="font-mono text-[11.5px] text-[--text-disabled]">{r.ip}</p> : null}
              </div>
              <time
                dateTime={r.at}
                title={`${timeFmt.format(new Date(r.at))} UTC`}
                className="tabular shrink-0 text-[12px] text-[--text-tertiary]"
              >
                {updatedAgo(r.at)}
              </time>
            </li>
          );
        })}
        {rows.length === 0 ? (
          <li className="px-4 py-14 text-center">
            <p className="text-sm text-foreground">Nothing yet.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Sign-ins and admin changes show up here.</p>
          </li>
        ) : null}
      </ol>

      {pages > 1 ? (
        <nav aria-label="Pagination" className="tabular mt-4 flex items-center justify-between px-1 text-[12.5px] text-muted-foreground">
          <span>
            Page {page + 1} of {pages}
          </span>
          <div className="flex gap-1">
            {page > 0 ? (
              <Link href={href(page - 1)} className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-foreground hover:bg-accent">
                <ChevronLeft className="h-4 w-4" aria-hidden /> Newer
              </Link>
            ) : null}
            {page < pages - 1 ? (
              <Link href={href(page + 1)} className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-foreground hover:bg-accent">
                Older <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
