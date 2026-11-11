"use client";

import { Loader2, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const toSlug = (v: string) => v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 64);

/** Search box for the home list. Filters on the server via ?q=, Enter opens or creates the note. */
export default function HomeSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const q = toSlug(value);
      start(() => router.replace(q ? `${pathname}?q=${q}` : pathname, { scroll: false }));
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === "/" && !typing) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const slug = toSlug(value).replace(/^-+|-+$/g, "");
        if (slug) router.push(`/${slug}`);
      }}
    >
      {pending ? (
        <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[--text-tertiary]" aria-hidden />
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-tertiary]" aria-hidden />
      )}
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setValue("");
            e.currentTarget.blur();
          }
        }}
        placeholder="Search notes, or type a name and press Enter"
        aria-label="Search notes"
        spellCheck={false}
        autoCapitalize="none"
        enterKeyHint="go"
        className="h-11 w-full rounded-lg border border-input bg-[--surface-dark] pl-9 pr-10 font-mono text-[13px] text-foreground placeholder:font-sans placeholder:text-[--text-tertiary] focus-visible:border-[--leaf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-20]"
      />
      {value ? null : (
        <kbd className="kbd pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex" aria-hidden>
          /
        </kbd>
      )}
    </form>
  );
}
