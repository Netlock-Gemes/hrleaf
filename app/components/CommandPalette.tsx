"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ArrowRight,
  CornerDownLeft,
  FileText,
  Home,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Search,
  Shield,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSignOut } from "@/app/hooks/useSignOut";
import { useTheme } from "@/app/hooks/useTheme";
import { OPEN_PALETTE_EVENT, PageCommand, usePageCommands } from "@/lib/commands";
import { readRecent } from "@/lib/recent";
import { updatedAgo } from "@/lib/site";
import { listNoteNames } from "@/server/document-actions";


type Item = {
  id: string;
  group: string;
  label: ReactNode;
  text: string;
  hint?: string;
  icon: ReactNode;
  depth?: number;
  /** Match strength; groups are ordered by their best match. */
  score?: number;
  run: () => void;
};

type Note = { slug: string; updated_at: string | null };

const toSlug = (v: string) =>
  v.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 64);

/** Higher is better; -1 means no match. Prefers exact, then prefix, then substring, then in-order letters. */
function score(text: string, q: string): number {
  if (!q) return 0;
  const t = text.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - t.length;
  const i = t.indexOf(q);
  if (i >= 0) return 600 - i * 4 - t.length;
  let pos = 0;
  let gaps = 0;
  for (const ch of q) {
    const next = t.indexOf(ch, pos);
    if (next < 0) return -1;
    gaps += next - pos;
    pos = next + 1;
  }
  return Math.max(1, 300 - gaps * 6 - t.length);
}

/** Bold the matched run so it's clear why a result is there. */
function Highlight({ text, q }: { text: string; q: string }) {
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-foreground">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function CommandPalette({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const pageCommands = usePageCommands();
  const { pref, setTheme } = useTheme();
  const { signOut } = useSignOut();
  const [mod, setMod] = useState("Ctrl ");
  useEffect(() => setMod(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl "), []);

  // Ctrl/⌘+K anywhere, or a "hrleaf:palette" event from a button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, []);

  // Fresh note list each time it opens (cheap: names and dates only).
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    let cancelled = false;
    listNoteNames()
      .then((n) => !cancelled && setNotes(n))
      .catch(() => !cancelled && setNotes((prev) => prev ?? []));
    return () => {
      cancelled = true;
    };
  }, [open]);

  const go = useCallback(
    (fn: () => void) => {
      setOpen(false);
      // Let the dialog close first so focus returns before navigation or editor commands.
      requestAnimationFrame(fn);
    },
    [],
  );

  const q = query.trim().toLowerCase();
  const slugQ = toSlug(query).replace(/^-+|-+$/g, "");

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const noteItem = (n: Note, group: string, score = 0): Item => ({
      score,
      id: `note:${n.slug}`,
      group,
      text: n.slug,
      label: <Highlight text={n.slug} q={q} />,
      hint: updatedAgo(n.updated_at) ?? undefined,
      icon: <FileText className="h-4 w-4" aria-hidden />,
      run: () => router.push(`/${n.slug}`),
    });

    // Notes
    const all = notes ?? [];
    if (!q) {
      const known = new Map(all.map((n) => [n.slug, n]));
      const recent = readRecent()
        .map((r) => known.get(r.slug))
        .filter((n): n is Note => !!n)
        .slice(0, 5);
      const shown = recent.length ? recent : all.slice(0, 5);
      out.push(...shown.map((n) => noteItem(n, recent.length ? "Recent" : "Notes")));
    } else {
      const matches = all
        .map((n) => ({ n, s: score(n.slug, q.replace(/\s+/g, "-")) }))
        .filter((m) => m.s >= 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 8)
        .map((m) => noteItem(m.n, "Notes", m.s));
      out.push(...matches);
      const exact = all.some((n) => n.slug === slugQ);
      if (slugQ && !exact) {
        out.push({
          id: "create",
          group: "Notes",
          // A new note is the fallback, never a better answer than a real match.
          score: 1,
          text: slugQ,
          label: (
            <>
              Create <span className="font-mono text-foreground">{slugQ}</span>
            </>
          ),
          icon: <Plus className="h-4 w-4" aria-hidden />,
          run: () => router.push(`/${slugQ}`),
        });
      }
    }

    // Commands from the current page (editor actions, headings)
    const page = pageCommands
      .map((c: PageCommand) => ({ c, s: q ? score(`${c.label} ${c.keywords ?? ""}`, q) : 0 }))
      .filter(({ c, s }) => s >= 0 && (q || c.group === "This note" || pageCommands.length < 12))
      .sort((a, b) => (q ? b.s - a.s : 0));
    for (const { c, s: sc } of page) {
      out.push({
        score: sc,
        id: c.id,
        group: c.group,
        text: c.label,
        label: <Highlight text={c.label} q={q} />,
        hint: c.hint,
        icon: c.icon ?? <ArrowRight className="h-4 w-4" aria-hidden />,
        depth: c.depth,
        run: c.run,
      });
    }

    // App actions
    const actions: (Omit<Item, "label" | "group"> & { keywords?: string })[] = [
      {
        id: "new",
        text: "New note…",
        keywords: "create add",
        hint: "N",
        icon: <Plus className="h-4 w-4" aria-hidden />,
        run: () => window.dispatchEvent(new Event("hrleaf:new-note")),
      },
      {
        id: "home",
        text: "All notes",
        keywords: "home list browse",
        icon: <Home className="h-4 w-4" aria-hidden />,
        run: () => router.push("/"),
      },
      ...(isAdmin
        ? [
            {
              id: "admin",
              text: "Admin",
              keywords: "users activity trash share dashboard",
              icon: <Shield className="h-4 w-4" aria-hidden />,
              run: () => router.push("/ainzooalgown"),
            },
          ]
        : []),
      ...(["light", "dark", "system"] as const)
        .filter((t) => t !== pref)
        .map((t) => ({
          id: `theme:${t}`,
          text: t === "system" ? "Use system theme" : `Switch to ${t} theme`,
          keywords: "appearance theme mode colour color light dark",
          icon:
            t === "light" ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : t === "dark" ? (
              <Moon className="h-4 w-4" aria-hidden />
            ) : (
              <Monitor className="h-4 w-4" aria-hidden />
            ),
          run: () => setTheme(t),
        })),
      {
        id: "signout",
        text: "Sign out",
        keywords: "log out logout",
        icon: <LogOut className="h-4 w-4" aria-hidden />,
        run: signOut,
      },
    ];
    for (const a of actions) {
      const s = q ? score(`${a.text} ${a.keywords ?? ""}`, q) : 0;
      if (s < 0) continue;
      out.push({ ...a, score: s, group: "Actions", label: <Highlight text={a.text} q={q} /> });
    }
    if (!q) return out;

    // With a query, the group holding the best match comes first; order inside groups is kept.
    const groups = new Map<string, Item[]>();
    for (const item of out) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
    const best = (list: Item[]) => Math.max(...list.map((i) => i.score ?? 0));
    return [...groups.values()].sort((a, b) => best(b) - best(a)).flat();
  }, [notes, q, slugQ, pageCommands, isAdmin, pref, router, setTheme, signOut]);

  useEffect(() => setActive(0), [q]);

  // Keep the active option in view.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[active];
      if (item) go(item.run);
    }
  };

  let lastGroup = "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="palette-overlay fixed inset-0 z-50 bg-[--overlay]" />
        <DialogPrimitive.Content
          aria-label="Command palette"
          aria-describedby={undefined}
          className="palette fixed left-1/2 top-[10svh] z-50 flex max-h-[min(34rem,80svh)] w-[calc(100vw-1.5rem)] max-w-[36rem] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-[--hairline] bg-popover text-popover-foreground shadow-[--shadow-float] focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-[--text-tertiary]" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search notes or type a command…"
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-activedescendant={items[active] ? `palette-${active}` : undefined}
              aria-autocomplete="list"
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              enterKeyHint="go"
              className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-[--text-tertiary] focus-visible:outline-none"
            />
            <kbd className="kbd hidden sm:inline-flex">esc</kbd>
          </div>

          <div ref={listRef} id="palette-list" role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
            {notes === null && !q ? (
              <div className="flex flex-col gap-1 p-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 motion-safe:animate-pulse rounded-md bg-[--row-active]" />
                ))}
              </div>
            ) : null}
            {items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <div key={item.id} role="presentation">
                  {header ? (
                    <div role="presentation" className="px-2.5 pb-1 pt-2.5 text-[11.5px] font-medium text-[--text-tertiary]">
                      {header}
                    </div>
                  ) : null}
                  <div
                    id={`palette-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => go(item.run)}
                    className={`flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-[13.5px] transition-colors duration-75 ${
                      i === active ? "bg-accent text-foreground" : "text-[--text-secondary]"
                    }`}
                    style={item.depth ? { paddingLeft: `${0.625 + item.depth * 0.875}rem` } : undefined}
                  >
                    <span className={i === active ? "text-[--leaf-strong]" : "text-[--text-tertiary]"}>{item.icon}</span>
                    <span className={`min-w-0 flex-1 truncate ${item.id.startsWith("note:") ? "font-mono text-[13px]" : ""}`}>
                      {item.label}
                    </span>
                    {item.hint ? <span className="tabular shrink-0 text-[12px] text-[--text-tertiary]">{item.hint}</span> : null}
                    {i === active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-[--text-tertiary]" aria-hidden /> : null}
                  </div>
                </div>
              );
            })}
            {items.length === 0 && notes !== null ? (
              <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                Nothing matches. Note names use lowercase letters, numbers and dashes.
              </p>
            ) : null}
          </div>

          <div className="hidden items-center gap-4 border-t border-border px-4 py-2 text-[12px] text-[--text-tertiary] sm:flex">
            <span className="flex items-center gap-1.5">
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd> to move
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="kbd">↵</kbd> to open
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <kbd className="kbd">{mod}K</kbd> anywhere
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
