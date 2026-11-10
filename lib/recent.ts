/** Recently opened notes, kept per-browser in localStorage. */

export type RecentNote = { slug: string; at: number };

const KEY = "hrleaf:recent";
const MAX = 12;

export function readRecent(): RecentNote[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((r): r is RecentNote => typeof r?.slug === "string" && typeof r?.at === "number")
      : [];
  } catch {
    return [];
  }
}

export function recordRecent(slug: string): RecentNote[] {
  const next = [{ slug, at: Date.now() }, ...readRecent().filter((r) => r.slug !== slug)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: recent list just won't persist */
  }
  return next;
}

export function clearRecent() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(`hrleaf:${key}`);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: boolean) {
  try {
    localStorage.setItem(`hrleaf:${key}`, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}
