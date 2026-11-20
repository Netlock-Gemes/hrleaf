import { ArrowRight, Download, Globe, Lock, PenLine, Users } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

import { formatBytes, relativeTime } from "@/lib/format";
import { AdminFilter, AdminStats, StorageInfo } from "@/types";

type Props = {
  stats: AdminStats;
  storage: StorageInfo;
  counts: Record<AdminFilter, number>;
  /** The admin's own username, shown as "you" in the edit list. */
  adminUsername: string;
  /** Member accounts, username → display name. Any other author is the admin (directly or via Claude). */
  members: Record<string, string>;
  now: number;
};

/**
 * Three ruled panels above the notes table: storage, recent edits and public links.
 * Each is a short ledger with one action pinned to its foot, so the row lines up.
 */
export default function OverviewPanels({ stats, storage, counts, adminUsername, members, now }: Props) {
  return (
    <section aria-label="Overview" className="grid gap-3 lg:grid-cols-3">
      <StoragePanel stats={stats} storage={storage} />
      <RecentPanel stats={stats} adminUsername={adminUsername} members={members} now={now} />
      <AccessPanel stats={stats} counts={counts} now={now} />
    </section>
  );
}

/* ---------------------------------- frame ---------------------------------- */

function Panel({
  title,
  figure,
  children,
  foot,
}: {
  title: string;
  figure?: ReactNode;
  children: ReactNode;
  foot: ReactNode;
}) {
  return (
    <section className="panel flex min-w-0 flex-col overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <h2 className="text-[13.5px] font-semibold tracking-[-0.005em]">{title}</h2>
        {figure ? <span className="tabular truncate text-[12.5px] text-muted-foreground">{figure}</span> : null}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-[--hairline]">{foot}</footer>
    </section>
  );
}

const footLink =
  "group flex h-11 w-full items-center justify-between gap-2 px-4 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-[--row-hover] hover:text-foreground sm:px-5";

function FootArrow() {
  return (
    <ArrowRight
      className="h-3.5 w-3.5 text-[--text-tertiary] transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-foreground"
      aria-hidden
    />
  );
}

/** One ruled line: a note name on the left, facts on the right. */
function Row({ href, children, meta, fill }: { href: string; children: ReactNode; meta: ReactNode; fill?: number }) {
  return (
    <li className="border-t border-[--hairline] first:border-t-0">
      <Link
        href={href}
        className="relative flex h-10 items-center justify-between gap-3 px-4 transition-colors duration-150 hover:bg-[--row-hover] sm:px-5"
      >
        {fill !== undefined ? (
          // Share of the largest: a faint green wash behind the line.
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 bg-[--pad-wash]"
            style={{ width: `${Math.max(2, fill * 100)}%` }}
          />
        ) : null}
        <span className="relative flex min-w-0 items-center gap-1.5 font-mono text-[13px] text-foreground">{children}</span>
        <span className="tabular relative flex shrink-0 items-center gap-2 text-[12.5px] text-muted-foreground">{meta}</span>
      </Link>
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-4 text-[13px] leading-relaxed text-[--text-tertiary] sm:px-5">{children}</p>;
}

/* --------------------------------- storage --------------------------------- */

/** How full the Atlas free tier is. The cluster figure includes other databases on it. */
function StoragePanel({ stats, storage }: { stats: AdminStats; storage: StorageInfo }) {
  const used = storage.clusterBytes ?? storage.appBytes;
  const other = Math.max(0, used - storage.appBytes);
  const free = Math.max(0, storage.limitBytes - used);
  const pct = Math.min(100, (used / storage.limitBytes) * 100);
  const appPct = Math.min(pct, (storage.appBytes / storage.limitBytes) * 100);
  const tone = pct > 85 ? "bg-[--danger-text]" : pct > 65 ? "bg-[--warn-text]" : "bg-[--leaf]";
  const largest = stats.largest.slice(0, 4);
  const top = Math.max(1, ...largest.map((l) => l.size));

  return (
    <Panel
      title="Storage"
      figure={`${pct < 1 ? pct.toFixed(1) : Math.round(pct)}% of ${formatBytes(storage.limitBytes)}`}
      foot={
        <a href="/ainzooalgown/export" download className={footLink}>
          <span>Download backup</span>
          <span className="flex items-center gap-2 text-[12px] text-[--text-tertiary] group-hover:text-foreground">
            JSON <Download className="h-3.5 w-3.5" aria-hidden />
          </span>
        </a>
      }
    >
      <div className="px-4 pb-4 sm:px-5">
        <div
          className="flex h-2 overflow-hidden rounded-[2px] bg-[--row-active]"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="Database storage used"
        >
          <div className={`h-full ${tone}`} style={{ width: `${Math.max(0.8, appPct)}%` }} />
          {other ? (
            <div className="h-full bg-[--text-disabled]" style={{ width: `${Math.max(0.5, pct - appPct)}%` }} />
          ) : null}
        </div>
        <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <Legend swatch={tone} label="HRLeaf" value={formatBytes(storage.appBytes)} />
          {storage.clusterBytes !== null ? (
            <Legend swatch="bg-[--text-disabled]" label="Other" value={formatBytes(other)} />
          ) : (
            <span />
          )}
          <Legend swatch="bg-[--row-active] ring-1 ring-inset ring-[--hairline]" label="Free" value={formatBytes(free)} />
        </dl>
      </div>

      <h3 className="flex items-baseline justify-between border-t border-[--hairline] px-4 pb-1.5 pt-3 text-[12px] text-[--text-tertiary] sm:px-5">
        <span>Largest notes</span>
        <span className="tabular">{formatBytes(stats.totalSize)} of text</span>
      </h3>
      {largest.length === 0 ? (
        <Empty>No notes yet.</Empty>
      ) : (
        <ol>
          {largest.map((l) => (
            <Row key={l.slug} href={`/${l.slug}`} meta={formatBytes(l.size)} fill={l.size / top}>
              <span className="truncate">{l.slug}</span>
            </Row>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 text-[--text-tertiary]">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-[1px] ${swatch}`} />
        {label}
      </dt>
      <dd className="truncate pl-3.5 text-foreground">{value}</dd>
    </div>
  );
}

/* ------------------------------ recent edits ------------------------------- */

function RecentPanel({
  stats,
  adminUsername,
  members,
  now,
}: {
  stats: AdminStats;
  adminUsername: string;
  members: Record<string, string>;
  now: number;
}) {
  /** Who saved it, as shown: a member's name, a public link, or you (in the editor or through Claude). */
  const who = (by: string | null): { kind: "member" | "link" | "you"; label: string } => {
    if (by && Object.hasOwn(members, by)) return { kind: "member", label: members[by] };
    if (by === "share link") return { kind: "link", label: "public link" };
    return { kind: "you", label: !by || by === adminUsername ? "you" : "you, via Claude" };
  };
  const byOthers = stats.recent.filter((r) => who(r.updated_by).kind !== "you").length;
  return (
    <Panel
      title="Recently edited"
      figure={byOthers ? `${byOthers} by others` : stats.recent.length ? "all by you" : undefined}
      foot={
        <Link href="/ainzooalgown?sort=updated_at" className={footLink}>
          <span>All notes by last edit</span>
          <FootArrow />
        </Link>
      }
    >
      {stats.recent.length === 0 ? (
        <Empty>Notes you and your members save show up here.</Empty>
      ) : (
        <ol className="border-t border-[--hairline]">
          {stats.recent.map((r) => {
            const author = who(r.updated_by);
            return (
              <Row
                key={r.slug}
                href={`/${r.slug}`}
                meta={
                  <>
                    {author.kind === "you" ? (
                      <span className="text-[--text-tertiary]">{author.label}</span>
                    ) : (
                      <span className="flex max-w-[9rem] items-center gap-1 text-foreground" title={`Saved by ${author.label}`}>
                        <PenLine className="h-3 w-3 shrink-0 text-[--leaf-strong]" aria-hidden />
                        <span className="truncate">{author.label}</span>
                      </span>
                    )}
                    <span aria-hidden className="text-[--text-disabled]">·</span>
                    <time dateTime={r.updated_at} title={new Date(r.updated_at).toUTCString()}>
                      {relativeTime(r.updated_at, now)}
                    </time>
                  </>
                }
              >
                <span className="truncate">{r.slug}</span>
                {r.visibility === "private" ? (
                  <Lock className="h-3 w-3 shrink-0 text-[--text-tertiary]" aria-label="Only you" />
                ) : null}
              </Row>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/* ---------------------------------- access --------------------------------- */

const SHARED_SHOWN = 3;

/** Who can open what: the split of notes by access, then the notes anyone can open. */
function AccessPanel({ stats, counts, now }: { stats: AdminStats; counts: Record<AdminFilter, number>; now: number }) {
  const total = counts.all;
  const team = Math.max(0, total - counts.private);
  const shared = stats.shared.slice(0, SHARED_SHOWN);
  const purgeIn = stats.nextPurgeAt ? relativeTime(stats.nextPurgeAt, now) : null;
  const split = [
    { key: "private", label: "Only me", n: counts.private, Icon: Lock, href: "/ainzooalgown?filter=private" },
    { key: "team", label: "Team", n: team, Icon: Users, href: "/ainzooalgown" },
    { key: "shared", label: "Public link", n: counts.shared, Icon: Globe, href: "/ainzooalgown?filter=shared" },
  ];

  return (
    <Panel
      title="Access"
      figure={`${total} notes`}
      foot={
        <Link href="/ainzooalgown?filter=shared" className={footLink}>
          <span>{counts.shared > SHARED_SHOWN ? `All ${counts.shared} public links` : "Manage public links"}</span>
          <FootArrow />
        </Link>
      }
    >
      <ol className="border-t border-[--hairline]">
        {split.map(({ key, label, n, Icon, href }) => (
          <li key={key} className="border-t border-[--hairline] first:border-t-0">
            <Link
              href={href}
              className="relative flex h-10 items-center justify-between gap-3 px-4 text-[13px] transition-colors duration-150 hover:bg-[--row-hover] sm:px-5"
            >
              {/* Share of all notes: a faint wash behind the line. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 bg-[--pad-wash]"
                style={{ width: `${total ? (n / total) * 100 : 0}%` }}
              />
              <span className="relative flex items-center gap-2 text-foreground">
                <Icon
                  className={`h-3.5 w-3.5 ${key === "shared" && n ? "text-[--leaf-strong]" : "text-[--text-tertiary]"}`}
                  aria-hidden
                />
                {label}
              </span>
              <span className="tabular relative text-[12.5px] text-muted-foreground">{n}</span>
            </Link>
          </li>
        ))}
      </ol>

      {shared.length ? (
        <>
          <h3 className="border-t border-[--hairline] px-4 pb-1.5 pt-3 text-[12px] text-[--text-tertiary] sm:px-5">
            Open without an account
          </h3>
          <ol>
            {shared.map((s) => (
              <Row
                key={s.slug}
                href={`/${s.slug}`}
                meta={
                  <span
                    className={`rounded-[3px] border px-1.5 py-px text-[11.5px] ${
                      s.mode === "write"
                        ? "border-[color-mix(in_oklab,var(--warn-text)_45%,transparent)] text-[--warn-text]"
                        : "border-[--hairline] text-[--text-secondary]"
                    }`}
                    title={s.created_at ? `Link made ${relativeTime(s.created_at, now)}` : undefined}
                  >
                    {s.mode === "write" ? "Can edit" : "Read only"}
                  </span>
                }
              >
                <span className="truncate">{s.slug}</span>
              </Row>
            ))}
          </ol>
        </>
      ) : null}

      {/* Housekeeping: things worth a glance, linked to their filter. */}
      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-[--hairline] px-4 py-2.5 text-[12px] text-[--text-tertiary] sm:px-5">
        <Link href="/ainzooalgown?filter=locked" className="tabular underline-offset-4 hover:text-foreground hover:underline">
          {counts.locked} locked
        </Link>
        <Link href="/ainzooalgown?filter=empty" className="tabular underline-offset-4 hover:text-foreground hover:underline">
          {counts.empty} empty
        </Link>
        <Link href="/ainzooalgown?filter=trash" className="tabular underline-offset-4 hover:text-foreground hover:underline">
          {counts.trash} in trash{purgeIn && counts.trash ? `, next removed ${purgeIn}` : ""}
        </Link>
      </div>
    </Panel>
  );
}
