"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  History,
  Link2Off,
  Loader2,
  Lock,
  LockKeyhole,
  LockOpen,
  MoreHorizontal,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import ShareDialog, { copyText, shareUrl } from "@/app/components/ShareDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AdminActionResult,
  ShareActionResult,
  deleteAllEmptyAction,
  deleteDocumentsAction,
  emptyTrashAction,
  purgeDocumentsAction,
  removeShareAction,
  renameDocumentAction,
  restoreFromTrashAction,
  restorePreviousAction,
  setLockedAction,
  setShareAction,
  setVisibilityAction,
} from "@/server/admin-actions";
import { AdminFilter, AdminListResult, AdminQuery, AdminSortKey, DocumentSummary, ShareMode } from "@/types";

import { formatBytes } from "./ActivityPanel";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relative(iso: string | undefined, now: number): string {
  if (!iso) return "—";
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

const toSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

type Confirm =
  | { kind: "delete"; slugs: string[] }
  | { kind: "purge"; slugs: string[] }
  | { kind: "emptyTrash"; count: number }
  | { kind: "empty"; count: number }
  | { kind: "restore"; slug: string };

const FILTER_LABELS: Record<AdminFilter, string> = {
  all: "All",
  shared: "Shared",
  private: "Only me",
  locked: "Locked",
  empty: "Empty",
  trash: "Trash",
};

export default function DocumentsTable({
  list,
  query,
  now,
}: {
  list: AdminListResult;
  query: AdminQuery;
  /** Request time from the server, so SSR and hydration agree on relative times. */
  now: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [navPending, startNav] = useTransition();
  const [actionPending, startAction] = useTransition();

  const [search, setSearch] = useState(query.q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [sharingSlug, setSharingSlug] = useState<string | null>(null);
  // Read from the latest server data, so the dialog reflects changes as they land.
  const sharing: DocumentSummary | null = list.rows.find((r) => r.slug === sharingSlug) ?? null;
  const setSharing = (d: DocumentSummary | null) => setSharingSlug(d?.slug ?? null);
  const [links, setLinks] = useState<{ slug: string; token: string; mode: ShareMode }[] | null>(null);
  const inTrash = query.filter === "trash";

  const rows = list.rows;
  const pageCount = Math.max(1, Math.ceil(list.total / list.pageSize));

  // Selection only refers to what's on screen.
  const rowKey = rows.map((r) => r.slug).join(",");
  useEffect(() => setSelected(new Set()), [rowKey]);

  /* ------------------------------- URL state ------------------------------- */

  const setParams = (
    patch: Partial<{ q: string; filter: AdminFilter; sort: AdminSortKey; desc: boolean; page: number }>,
  ) => {
    const next = { ...query, ...patch };
    const p = new URLSearchParams();
    if (next.q) p.set("q", next.q);
    if (next.filter !== "all") p.set("filter", next.filter);
    if (next.sort !== "updated_at") p.set("sort", next.sort);
    if (!next.desc) p.set("dir", "asc");
    if (next.page > 0) p.set("page", String(next.page + 1));
    const qs = p.toString();
    startNav(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Debounced search -> URL (the server does the filtering).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      const q = toSlug(search);
      if (q !== query.q) setParams({ q, page: 0 });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Keyboard: "/" focuses search, Escape clears the selection.
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && !typing) {
        setSelected(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleSort = (key: AdminSortKey) =>
    setParams(
      query.sort === key ? { desc: !query.desc, page: 0 } : { sort: key, desc: key !== "slug", page: 0 },
    );

  /* -------------------------------- actions -------------------------------- */

  const shareMany = (mode: ShareMode) =>
    startAction(async () => {
      const res: ShareActionResult = await setShareAction(selectedList, mode);
      if (!res.ok) return void toast.error(res.message);
      setSelected(new Set());
      setLinks(res.links);
    });

  const run = (fn: () => Promise<AdminActionResult>, after?: () => void) =>
    startAction(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message);
        after?.();
      } else {
        toast.error(res.message);
      }
    });

  const typedSlug = toSlug(search);
  const exactMatch = useMemo(() => rows.some((r) => r.slug === typedSlug), [rows, typedSlug]);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.slug));
  const someSelected = selected.size > 0 && !allSelected;
  const selectedList = [...selected];

  const toggleRow = (slug: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(slug)) n.delete(slug);
      else n.add(slug);
      return n;
    });

  return (
    <section aria-label="All documents">
      <div className="panel overflow-clip">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (typedSlug) router.push(`/${typedSlug}`);
          }}
        >
          {navPending ? (
            <Loader2
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[--text-tertiary]"
              aria-hidden
            />
          ) : (
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-tertiary]"
              aria-hidden
            />
          )}
          <input
            ref={searchRef}
            type="search"
            value={search}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearch("");
                e.currentTarget.blur();
              }
            }}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or open a note…"
            aria-label="Search documents"
            spellCheck={false}
            autoCapitalize="none"
            className="h-10 w-full rounded-lg border border-input bg-[--surface-dark] pl-9 pr-10 font-mono text-[13px] text-foreground placeholder:font-sans placeholder:text-[--text-tertiary] focus-visible:border-[--leaf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-20]"
          />
          {search ? null : (
            <kbd className="kbd pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex" aria-hidden>
              /
            </kbd>
          )}
        </form>

        <div className="flex items-center gap-2">
          <div
            role="tablist"
            aria-label="Filter documents"
            className="flex h-10 min-w-0 flex-1 items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-[--surface-dark] p-1 [scrollbar-width:none] lg:flex-none"
          >
            {(Object.keys(FILTER_LABELS) as AdminFilter[]).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={query.filter === f}
                onClick={() => setParams({ filter: f, page: 0 })}
                className={`tabular flex h-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] transition-colors duration-150 ${
                  query.filter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {FILTER_LABELS[f]}
                <span className="text-[--text-tertiary]">{list.counts[f]}</span>
              </button>
            ))}
          </div>
          {inTrash && list.counts.trash > 0 ? (
            <button
              type="button"
              onClick={() => setConfirm({ kind: "emptyTrash", count: list.counts.trash })}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:border-destructive/40 hover:bg-destructive/10 hover:text-[--danger-text]"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Empty trash</span>
            </button>
          ) : null}
          {list.counts.empty > 0 && !query.q && !inTrash ? (
            <button
              type="button"
              onClick={() => setConfirm({ kind: "empty", count: list.counts.empty })}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:border-destructive/40 hover:bg-destructive/10 hover:text-[--danger-text]"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Delete empty</span>
              <span className="tabular text-[--text-tertiary]">{list.counts.empty}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className={`transition-opacity duration-150 ${navPending ? "opacity-60" : ""}`} aria-busy={navPending}>
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-11" />
            <col />
            <col className="hidden w-[6.5rem] md:table-column" />
            <col className="hidden w-[11rem] lg:table-column" />
            <col className="w-[6.5rem] sm:w-[9.5rem]" />
            <col className="w-[5.25rem] sm:w-[7.5rem]" />
          </colgroup>
          <thead>
            <tr className="text-left text-[12px] text-muted-foreground [&>th]:sticky [&>th]:top-14 [&>th]:z-10 [&>th]:bg-[--header-th] [&>th]:shadow-[inset_0_-1px_0_hsl(var(--border))] [&>th]:backdrop-blur-sm">
              <th className="py-2.5 pl-4 pr-1">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={rows.length === 0}
                  label={allSelected ? "Deselect all on this page" : "Select all on this page"}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.slug)))}
                />
              </th>
              <SortHeader label="Name" k="slug" query={query} onSort={toggleSort} />
              <SortHeader label="Size" k="size" query={query} onSort={toggleSort} className="hidden md:table-cell" />
              <SortHeader label="Created" k="created_at" query={query} onSort={toggleSort} className="hidden lg:table-cell" />
              <SortHeader label={inTrash ? "Deleted" : "Modified"} k="updated_at" query={query} onSort={toggleSort} />
              <th className="px-3 py-2.5 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {typedSlug && !exactMatch && query.page === 0 && !inTrash ? (
              <tr className="border-b border-border">
                <td colSpan={6} className="p-0">
                  <Link
                    href={`/${typedSlug}`}
                    className="flex items-center gap-2 px-4 py-3 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="h-4 w-4 text-[--leaf]" aria-hidden />
                    Create <span className="font-mono text-foreground">{typedSlug}</span>
                  </Link>
                </td>
              </tr>
            ) : null}

            {rows.map((d) => {
              const isSelected = selected.has(d.slug);
              return (
                <tr
                  key={d.slug}
                  className={`group border-b border-border/70 transition-colors duration-100 last:border-0 ${
                    isSelected ? "bg-[--primary-10]" : "hover:bg-[--row-hover]"
                  }`}
                >
                  <td className="py-3 pl-4 pr-1 align-top">
                    <Checkbox checked={isSelected} label={`Select ${d.slug}`} onChange={() => toggleRow(d.slug)} />
                  </td>
                  <td className="py-3 pl-1 pr-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <Link
                        href={`/${d.slug}`}
                        className="min-w-0 truncate font-mono text-[13px] font-medium text-foreground underline-offset-4 decoration-[--text-tertiary] hover:underline"
                      >
                        {d.slug}
                      </Link>
                      {d.visibility === "private" ? (
                        <RowBadge icon={<LockKeyhole className="h-3 w-3" aria-hidden />} label="Only me" />
                      ) : null}
                      {d.share ? (
                        <RowBadge
                          tone="leaf"
                          icon={<Globe className="h-3 w-3" aria-hidden />}
                          label={d.share.mode === "write" ? "Public · edit" : "Public"}
                        />
                      ) : null}
                      {d.read_only ? <RowBadge icon={<Lock className="h-3 w-3" aria-hidden />} label="Locked" /> : null}
                    </div>
                    <p
                      className={`mt-0.5 truncate text-[12px] ${d.is_empty ? "italic text-[--text-disabled]" : "text-[--text-tertiary]"}`}
                      title={d.preview || undefined}
                    >
                      {d.is_empty ? "Empty" : d.preview || "No text"}
                      {d.updated_by && !inTrash ? <span className="not-italic text-[--text-disabled]"> · {d.updated_by}</span> : null}
                    </p>
                  </td>
                  <td className="tabular hidden px-3 py-2.5 text-[13px] text-muted-foreground md:table-cell">
                    {d.is_empty ? "—" : formatBytes(d.size)}
                  </td>
                  <td className="tabular hidden px-3 py-2.5 text-[13px] text-muted-foreground lg:table-cell">
                    {d.created_at ? dateFmt.format(new Date(d.created_at)) : "—"}
                  </td>
                  <td
                    className="tabular px-3 py-2.5 text-[13px] text-[--text-secondary]"
                    title={(inTrash ? d.deleted_at : d.updated_at) ? `${dateFmt.format(new Date((inTrash ? d.deleted_at : d.updated_at)!))} UTC` : undefined}
                  >
                    {relative(inTrash ? d.deleted_at : d.updated_at, now)}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end gap-0.5 transition-opacity duration-150 md:opacity-55 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                      {inTrash ? (
                        <>
                          <IconButton label={`Restore ${d.slug}`} onClick={() => run(() => restoreFromTrashAction([d.slug]))}>
                            <RotateCcw className="h-4 w-4" />
                          </IconButton>
                          <IconButton label={`Delete ${d.slug} forever`} onClick={() => setConfirm({ kind: "purge", slugs: [d.slug] })}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </>
                      ) : (
                        <>
                      <IconButton label={`Share settings for ${d.slug}`} onClick={() => setSharing(d)} className="hidden sm:flex">
                        <Globe className={`h-4 w-4 ${d.share ? "text-[--leaf-strong]" : ""}`} />
                      </IconButton>
                      <IconButton
                        label={d.read_only ? `Unlock ${d.slug}` : `Lock ${d.slug}`}
                        onClick={() => run(() => setLockedAction([d.slug], !d.read_only))}
                      >
                        {d.read_only ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </IconButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          aria-label={`More actions for ${d.slug}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-[--text-tertiary] transition-colors duration-150 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          <DropdownMenuItem className="gap-2" onSelect={() => setSharing(d)}>
                            <Globe className="h-4 w-4" aria-hidden /> Share settings…
                          </DropdownMenuItem>
                          {d.share ? (
                            <DropdownMenuItem className="gap-2" onSelect={() => copyText(shareUrl(d.share!.token), "Public link copied")}>
                              <Copy className="h-4 w-4" aria-hidden /> Copy public link
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => run(() => setVisibilityAction([d.slug], d.visibility === "private" ? "team" : "private"))}
                          >
                            {d.visibility === "private" ? (
                              <>
                                <Users className="h-4 w-4" aria-hidden /> Show to team
                              </>
                            ) : (
                              <>
                                <LockKeyhole className="h-4 w-4" aria-hidden /> Make only me
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2" onSelect={() => setRenaming(d.slug)}>
                            <PenLine className="h-4 w-4" aria-hidden /> Rename…
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            disabled={!d.has_previous}
                            onSelect={() => setConfirm({ kind: "restore", slug: d.slug })}
                          >
                            <History className="h-4 w-4" aria-hidden />
                            <div className="flex flex-col">
                              <span>Restore previous version</span>
                              {!d.has_previous ? (
                                <span className="text-[12px] text-muted-foreground">No previous version saved</span>
                              ) : null}
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onSelect={() => window.open(`/${d.slug}`, "_blank", "noopener")}>
                            <ExternalLink className="h-4 w-4" aria-hidden /> Open in new tab
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => window.open(`/${d.slug}/view`, "_blank", "noopener")}
                          >
                            <Eye className="h-4 w-4" aria-hidden /> Open read-only view
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="gap-2 text-[--danger-text] focus:bg-destructive/15 focus:text-[--danger-text]"
                            onSelect={() => setConfirm({ kind: "delete", slugs: [d.slug] })}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden /> Move to trash…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && !(typedSlug && !exactMatch) ? (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center">
                  <p className="text-sm text-foreground">
                    {query.filter === "empty"
                      ? "No empty notes. Nice and tidy."
                      : inTrash
                        ? "The trash is empty."
                        : query.filter === "shared"
                          ? "No notes have a public link."
                          : query.filter === "private"
                            ? "No notes are hidden from members."
                            : "No documents match."}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {query.q
                      ? "Try a shorter search, or switch the filter to All."
                      : inTrash
                        ? "Deleted notes stay here for 30 days, then they're removed for good."
                        : query.filter !== "all"
                        ? "Switch the filter to All to see everything."
                        : "Notes appear here once someone saves one."}
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Footer + pagination */}
      {list.total > 0 ? (
        <nav aria-label="Pagination" className="tabular flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[12.5px] text-muted-foreground">
          <span>
            Showing <span className="text-foreground">{query.page * list.pageSize + 1}–{Math.min(list.total, (query.page + 1) * list.pageSize)}</span> of {list.total}
          </span>
          {list.total > list.pageSize ? (
          <div className="flex gap-1">
            <button
              onClick={() => setParams({ page: query.page - 1 })}
              disabled={query.page === 0 || navPending}
              className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-foreground transition-colors duration-150 hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </button>
            <button
              onClick={() => setParams({ page: query.page + 1 })}
              disabled={query.page >= pageCount - 1 || navPending}
              className="flex h-7 items-center gap-1 rounded-md border border-border px-2 text-foreground transition-colors duration-150 hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
          ) : (
            <span className="hidden items-center gap-1.5 text-[--text-tertiary] sm:flex">
              <kbd className="kbd">/</kbd> search
              <kbd className="kbd ml-2">N</kbd> new note
            </span>
          )}
        </nav>
      ) : null}
      </div>

      {/* Bulk action bar */}
      <div
        className={`fixed inset-x-0 bottom-4 z-40 flex justify-center px-3 transition-[opacity,transform] duration-200 ease-out ${
          selected.size ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
        aria-hidden={!selected.size}
      >
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex items-center gap-1 rounded-xl border border-border bg-popover p-1.5 pl-3 shadow-[--shadow-float]"
        >
          <span className="tabular mr-1 text-[13px] text-foreground">{selected.size}<span className="hidden sm:inline"> selected</span></span>
          {inTrash ? (
            <>
              <BulkButton
                disabled={actionPending}
                onClick={() => run(() => restoreFromTrashAction(selectedList), () => setSelected(new Set()))}
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Restore
              </BulkButton>
              <BulkButton danger disabled={actionPending} onClick={() => setConfirm({ kind: "purge", slugs: selectedList })}>
                <Trash2 className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Delete forever</span>
              </BulkButton>
            </>
          ) : (
            <>
              <BulkButton
                disabled={actionPending}
                onClick={() => run(() => setLockedAction(selectedList, true), () => setSelected(new Set()))}
              >
                <Lock className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Lock</span>
              </BulkButton>
              <BulkButton
                disabled={actionPending}
                onClick={() => run(() => setLockedAction(selectedList, false), () => setSelected(new Set()))}
              >
                <LockOpen className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Unlock</span>
              </BulkButton>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={actionPending}
                  className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-foreground transition-colors duration-150 hover:bg-accent disabled:opacity-50 data-[state=open]:bg-accent"
                >
                  <Globe className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Access</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="w-60">
                  <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Public links</DropdownMenuLabel>
                  <DropdownMenuItem className="gap-2" onSelect={() => shareMany("read")}>
                    <Eye className="h-4 w-4" aria-hidden /> Create read-only links
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onSelect={() => shareMany("write")}>
                    <PenLine className="h-4 w-4" aria-hidden /> Create edit links
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => run(() => removeShareAction(selectedList), () => setSelected(new Set()))}
                  >
                    <Link2Off className="h-4 w-4" aria-hidden /> Turn off links
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Signed-in access</DropdownMenuLabel>
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => run(() => setVisibilityAction(selectedList, "team"), () => setSelected(new Set()))}
                  >
                    <Users className="h-4 w-4" aria-hidden /> Show to team
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => run(() => setVisibilityAction(selectedList, "private"), () => setSelected(new Set()))}
                  >
                    <LockKeyhole className="h-4 w-4" aria-hidden /> Make only me
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <BulkButton danger disabled={actionPending} onClick={() => setConfirm({ kind: "delete", slugs: selectedList })}>
                <Trash2 className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">Trash</span>
              </BulkButton>
            </>
          )}
          <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label="Clear selection"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[--text-tertiary] transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Confirmations */}
      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="max-w-sm">
          {confirm?.kind === "delete" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirm.slugs.length === 1 ? "Move this note to the trash?" : `Move ${plural(confirm.slugs.length, "note")} to the trash?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm.slugs.length === 1 ? (
                    <span className="font-mono text-foreground">{confirm.slugs[0]}</span>
                  ) : (
                    "They"
                  )}{" "}
                  can&apos;t be opened while in the trash, and share links stop working. You can restore{" "}
                  {confirm.slugs.length === 1 ? "it" : "them"} for 30 days, then {confirm.slugs.length === 1 ? "it's" : "they're"} deleted for good.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep {confirm.slugs.length === 1 ? "it" : "them"}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => run(() => deleteDocumentsAction(confirm.slugs), () => setSelected(new Set()))}
                >
                  Move to trash
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : confirm?.kind === "purge" || confirm?.kind === "emptyTrash" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirm.kind === "emptyTrash"
                    ? "Empty the trash?"
                    : confirm.slugs.length === 1
                      ? "Delete this note forever?"
                      : `Delete ${plural(confirm.slugs.length, "note")} forever?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm.kind === "emptyTrash"
                    ? `${plural(confirm.count, "note")} will be deleted permanently.`
                    : "They'll be deleted permanently."}{" "}
                  This can&apos;t be undone. Download a backup first if you might need them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() =>
                    confirm.kind === "emptyTrash"
                      ? run(() => emptyTrashAction())
                      : run(() => purgeDocumentsAction(confirm.slugs), () => setSelected(new Set()))
                  }
                >
                  Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : confirm?.kind === "empty" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all empty notes?</AlertDialogTitle>
                <AlertDialogDescription>
                  {plural(confirm.count, "note")} with no content will be removed. Locked and shared notes are kept.
                  Opening one of those names later just starts a fresh note.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => run(() => deleteAllEmptyAction())}
                >
                  Delete empty notes
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : confirm?.kind === "restore" ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Restore the previous version?</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-mono text-foreground">{confirm.slug}</span> goes back to its previous save. The
                  current content becomes the previous version, so you can switch back the same way.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(() => restorePreviousAction(confirm.slug))}>
                  Restore
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      <RenameDialog slug={renaming} onClose={() => setRenaming(null)} />
      <ShareDialog
        slug={sharing?.slug ?? null}
        share={sharing?.share ?? null}
        visibility={sharing?.visibility ?? "team"}
        open={sharing !== null}
        onOpenChange={(o) => !o && setSharing(null)}
      />
      <LinksDialog links={links} onClose={() => setLinks(null)} />
    </section>
  );
}

function RenameDialog({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (slug) {
      setValue(slug);
      setError(null);
    }
  }, [slug]);

  const submit = () =>
    start(async () => {
      const res = await renameDocumentAction(slug ?? "", value);
      if (res.ok) {
        toast.success(res.message);
        onClose();
      } else {
        setError(res.message);
      }
    });

  return (
    <Dialog open={slug !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename note</DialogTitle>
          <DialogDescription>
            Changes its address. The old address <span className="font-mono text-foreground">/{slug}</span> will open
            a new, empty note. Public share links keep working.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center rounded-lg border border-input bg-[--surface-dark] focus-within:border-[--leaf] focus-within:ring-2 focus-within:ring-[--primary-20]">
            <span className="pl-3 font-mono text-[13px] text-[--text-tertiary]">/</span>
            <input
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(toSlug(e.target.value));
                setError(null);
              }}
              aria-label="New name"
              aria-invalid={!!error}
              aria-describedby={error ? "rename-error" : "rename-hint"}
              spellCheck={false}
              autoCapitalize="none"
              className="h-10 w-full bg-transparent pl-0.5 pr-3 font-mono text-[13px] text-foreground outline-none focus-visible:outline-none"
            />
          </div>
          {error ? (
            <p id="rename-error" role="alert" className="text-[13px] text-[--danger-text]">
              {error}
            </p>
          ) : (
            <p id="rename-hint" className="text-[12px] text-[--text-tertiary]">
              Lowercase letters, numbers and dashes.
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !value || value === slug}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Rename
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Checkbox({
  checked,
  indeterminate = false,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
      className="admin-checkbox"
    />
  );
}

function SortHeader({
  label,
  k,
  query,
  onSort,
  className = "",
}: {
  label: string;
  k: AdminSortKey;
  query: AdminQuery;
  onSort: (k: AdminSortKey) => void;
  className?: string;
}) {
  const active = query.sort === k;
  const Arrow = query.desc ? ArrowDown : ArrowUp;
  return (
    <th
      aria-sort={active ? (query.desc ? "descending" : "ascending") : "none"}
      className={`px-3 py-2 font-medium ${k === "slug" ? "pl-1" : ""} ${className}`}
    >
      <button
        onClick={() => onSort(k)}
        className={`-mx-1 flex items-center gap-1 rounded px-1 py-0.5 transition-colors duration-150 hover:text-foreground ${
          active ? "text-foreground" : ""
        }`}
      >
        {label}
        {active ? <Arrow className="h-3 w-3" aria-hidden /> : null}
      </button>
    </th>
  );
}

function BulkButton({
  danger,
  disabled,
  onClick,
  children,
}: {
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors duration-150 disabled:opacity-50 ${
        danger ? "text-[--danger-text] hover:bg-destructive/15" : "text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  href,
  className = "",
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const cls = `${className || "flex"} h-8 w-8 items-center justify-center rounded-md text-[--text-tertiary] transition-colors duration-150 hover:bg-accent hover:text-foreground`;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cls}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>
      {children}
    </button>
  );
}

function LinksDialog({
  links,
  onClose,
}: {
  links: { slug: string; token: string; mode: ShareMode }[] | null;
  onClose: () => void;
}) {
  const text = (links ?? []).map((l) => `${l.slug}: ${shareUrl(l.token)}`).join("\n");
  return (
    <Dialog open={links !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Public links</DialogTitle>
          <DialogDescription>
            Anyone with one of these links can {links?.[0]?.mode === "write" ? "read and edit" : "read"} that note. Notes
            that already had a link keep the same one.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {(links ?? []).map((l) => (
            <li key={l.slug} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-[13px] text-foreground">{l.slug}</p>
                <p className="truncate font-mono text-[12px] text-[--text-tertiary]">{shareUrl(l.token)}</p>
              </div>
              <button
                type="button"
                onClick={() => copyText(shareUrl(l.token), `Link for ${l.slug} copied`)}
                aria-label={`Copy link for ${l.slug}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[--text-tertiary] transition-colors hover:bg-accent hover:text-foreground"
              >
                <Copy className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <button
            type="button"
            onClick={() => copyText(text, "All links copied")}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Copy className="h-4 w-4" aria-hidden /> Copy all
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RowBadge({ icon, label, tone }: { icon: React.ReactNode; label: string; tone?: "leaf" }) {
  return (
    <span
      title={label}
      className={`flex shrink-0 items-center gap-1 rounded-full border p-1 text-[11px] sm:px-1.5 sm:py-px ${
        tone === "leaf" ? "border-[--leaf]/35 text-[--leaf-strong]" : "border-border text-[--text-secondary]"
      }`}
    >
      {icon}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </span>
  );
}
