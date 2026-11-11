"use client";

import { ArrowRight, Check, CornerDownLeft, Loader2, Plus, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NameCheck, checkNoteName, suggestNoteNames } from "@/server/document-actions";

const toSlug = (v: string) =>
  v
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);

interface NewNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Override navigation (e.g. to guard unsaved changes). Defaults to router.push. */
  onNavigate?: (href: string) => void;
}

/**
 * "New note" dialog: pick a name, see instantly whether it's free,
 * or take one of the suggested names.
 */
export default function NewNoteDialog({ open, onOpenChange, onNavigate }: NewNoteDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<NameCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, startSuggestions] = useTransition();
  const [going, setGoing] = useState(false);
  const requestId = useRef(0);

  const loadSuggestions = useCallback(() => {
    startSuggestions(async () => setSuggestions(await suggestNoteNames()));
  }, []);

  // Reset each time it opens.
  useEffect(() => {
    if (!open) return;
    setValue("");
    setCheck(null);
    setGoing(false);
    loadSuggestions();
  }, [open, loadSuggestions]);

  // Debounced availability check.
  useEffect(() => {
    const slug = toSlug(value).replace(/-+$/, "");
    if (!slug) {
      setCheck(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      const result = await checkNoteName(slug).catch(() => null);
      if (id !== requestId.current) return; // a newer keystroke won
      setCheck(result);
      setChecking(false);
    }, 220);
    return () => clearTimeout(t);
  }, [value]);

  const go = (slug: string) => {
    setGoing(true);
    const href = `/${slug}`;
    onOpenChange(false);
    if (onNavigate) onNavigate(href);
    else router.push(href);
  };

  const slug = toSlug(value).replace(/-+$/, "");
  const ready = !checking && check && check.status !== "invalid" && check.slug === slug;

  const submit = () => {
    if (ready) go(check.slug);
  };

  const pick = (s: string) => {
    setValue(s);
    inputRef.current?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="new-note-dialog max-w-[26rem] gap-0 p-0">
        <DialogHeader className="px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[1.05rem]">New note</DialogTitle>
          <DialogDescription className="text-[13px]">
            Pick a name for its address. Anyone with the link can open it.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="px-5"
        >
          <label htmlFor="new-note-name" className="sr-only">
            Note name
          </label>
          <div
            className={`flex h-11 items-center rounded-lg border bg-[--surface-dark] transition-[border-color,box-shadow] duration-150 focus-within:ring-2 ${
              check?.status === "invalid" && !checking
                ? "border-destructive/60 focus-within:ring-destructive/20"
                : "border-input focus-within:border-[--leaf] focus-within:ring-[--primary-20]"
            }`}
          >
            <span className="select-none pl-3 font-mono text-[13px] text-[--text-tertiary]">
              hrleaf/
            </span>
            <input
              ref={inputRef}
              id="new-note-name"
              autoFocus
              value={value}
              onChange={(e) => setValue(toSlug(e.target.value))}
              placeholder="my-note"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="new-note-status"
              className="h-full min-w-0 flex-1 bg-transparent pr-2 font-mono text-[14px] text-foreground outline-none placeholder:text-[--text-disabled] focus-visible:outline-none"
            />
            <span className="pr-3">
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin text-[--text-tertiary]" aria-hidden />
              ) : check?.status === "available" ? (
                <Check className="h-4 w-4 text-[--leaf]" aria-hidden />
              ) : null}
            </span>
          </div>

          <p id="new-note-status" role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-[12.5px]">
            {!slug ? (
              <span className="text-[--text-tertiary]">Letters, numbers and dashes. Spaces become dashes.</span>
            ) : checking ? (
              <span className="text-[--text-tertiary]">Checking…</span>
            ) : check?.status === "available" ? (
              <span className="text-[--leaf-strong]">Available</span>
            ) : check?.status === "exists" ? (
              <span className="text-[hsl(38_85%_68%)]">A note with this name already exists. You can open it.</span>
            ) : check?.status === "invalid" ? (
              <span className="text-[hsl(2_80%_72%)]">{check.message}</span>
            ) : null}
          </p>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-medium text-muted-foreground">Suggestions</span>
              <button
                type="button"
                onClick={loadSuggestions}
                disabled={loadingSuggestions}
                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-[--text-tertiary] transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <Shuffle className={`h-3.5 w-3.5 ${loadingSuggestions ? "animate-spin" : ""}`} aria-hidden />
                Shuffle
              </button>
            </div>
            <div className="flex min-h-[4.5rem] flex-wrap content-start gap-1.5">
              {suggestions.length === 0 && loadingSuggestions
                ? [0, 1, 2, 3].map((i) => (
                    <span key={i} className="h-8 w-32 animate-pulse rounded-md bg-[--surface-dark]" />
                  ))
                : suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => pick(s)}
                      className={`h-8 rounded-md border px-2.5 font-mono text-[12.5px] transition-colors duration-150 ${
                        slug === s
                          ? "border-[--leaf]/60 bg-[--primary-10] text-[--leaf-strong]"
                          : "border-border text-[--text-secondary] hover:border-[--surface-light] hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
            </div>
          </div>

          <div className="-mx-5 mt-5 flex items-center justify-between gap-3 border-t border-border px-5 py-3.5">
            <span className="hidden items-center gap-1.5 text-[12px] text-[--text-tertiary] sm:flex">
              <kbd className="flex h-5 items-center rounded border border-border px-1">
                <CornerDownLeft className="h-3 w-3" aria-hidden />
              </kbd>
              to {check?.status === "exists" ? "open" : "create"}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-9 rounded-md px-3 text-[13px] text-[--text-secondary] transition-colors hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!ready || going}
                className="flex h-9 items-center gap-1.5 rounded-md bg-[--leaf] px-3.5 text-[13px] font-medium text-[#0f1a13] transition-[background-color,opacity] duration-150 hover:bg-[--leaf-strong] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {check?.status === "exists" ? (
                  <>
                    Open note <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" aria-hidden /> Create note
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** A "New" button that opens the dialog. */
export function NewNoteButton({
  label = "New",
  variant = "ghost",
  onNavigate,
  shortcut = false,
}: {
  label?: string;
  variant?: "ghost" | "primary";
  onNavigate?: (href: string) => void;
  /** Bind the "N" key to open the dialog. */
  shortcut?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="New note"
        title={shortcut ? "New note (N)" : "New note"}
        className={
          variant === "primary"
            ? "flex h-9 items-center gap-1.5 rounded-lg bg-[--leaf] px-3 text-[13px] font-medium text-[#0f1a13] shadow-[0_1px_0_rgba(255,255,255,0.22)_inset,0_6px_16px_-8px_rgba(76,196,126,0.55)] transition-colors duration-150 hover:bg-[--leaf-strong]"
            : "flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground"
        }
      >
        <Plus className="h-4 w-4" aria-hidden />
        <span className={variant === "primary" ? "" : "hidden md:inline"}>{label}</span>
        {variant === "primary" && shortcut ? (
          <kbd className="ml-1 hidden rounded bg-black/20 px-1.5 text-[11px] font-semibold leading-5 text-[#0f1a13]/90 sm:inline">
            N
          </kbd>
        ) : null}
      </button>
      <NewNoteDialog open={open} onOpenChange={setOpen} onNavigate={onNavigate} />
    </>
  );
}
