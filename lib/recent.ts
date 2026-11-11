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

/* --------------------------------- drafts --------------------------------- */

/**
 * Unsaved changes kept in this browser, so a crash or a closed tab doesn't lose work.
 * Keyed by note ("note:<slug>") or share link ("share:<token>").
 */
export type Draft = { content: string; base: string | null; at: number };

const draftKey = (key: string) => `hrleaf:draft:${key}`;

export function readDraft(key: string): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(key)) ?? "null");
    return d && typeof d.content === "string" && typeof d.at === "number" ? d : null;
  } catch {
    return null;
  }
}

export function writeDraft(key: string, draft: Draft) {
  try {
    localStorage.setItem(draftKey(key), JSON.stringify(draft));
  } catch {
    /* storage full or blocked: drafts are best-effort */
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(draftKey(key));
  } catch {
    /* ignore */
  }
}

/** On sign-out: forget recent notes and drafts on this device. Keeps display preferences. */
export function clearLocalNotes() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k === KEY || k.startsWith("hrleaf:draft:")) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}
