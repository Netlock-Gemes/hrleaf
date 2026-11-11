/** Brand copy and URLs shared by metadata, OG images and the manifest. */

export const SITE_NAME = "HRLeaf";

export const SITE_DESCRIPTION =
  "A private notebook for a small team. Notes open only for invited accounts, or through a link you choose to share.";

/** Absolute base URL for metadata (OG images need absolute links). */
export function siteUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3000");
  }
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function updatedAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 60) return "just now";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  if (a < 86400 * 365) return rtf.format(Math.round(s / (86400 * 30)), "month");
  return rtf.format(Math.round(s / (86400 * 365)), "year");
}

/**
 * Short, content-free summary of a note for link previews.
 * Deliberately never includes the note's text: previews are cached by chat apps.
 */
export function noteSummary(doc: {
  exists: boolean;
  words: number;
  updated_at: string | null;
  read_only: boolean;
}): string[] {
  if (!doc.exists) return ["New note"];
  const parts: string[] = [];
  const ago = updatedAgo(doc.updated_at);
  if (ago) parts.push(`Updated ${ago}`);
  parts.push(`${doc.words.toLocaleString("en")} word${doc.words === 1 ? "" : "s"}`);
  if (doc.read_only) parts.push("Read only");
  return parts;
}
