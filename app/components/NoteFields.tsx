/** Formats a saved date as "12 Nov 2026". */
export function formatNoteDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

/**
 * The sheet's ruled header, like the fields printed across the top of a columnar pad:
 * which note this is, who can see it, and when it was last saved.
 */
export default function NoteFields({
  name,
  access,
  updatedAt,
}: {
  name: string;
  access: string;
  updatedAt?: string | null;
}) {
  const date = formatNoteDate(updatedAt);
  return (
    <header className="pad-fields">
      <div className="pad-field pad-field-name">
        <span className="pad-label">Note</span>
        <span className="pad-value">{name}</span>
      </div>
      <div className="pad-field pad-field-access">
        <span className="pad-label">Access</span>
        <span className="pad-value">{access}</span>
      </div>
      <div className="pad-field">
        <span className="pad-label">Updated</span>
        <span className="pad-value" suppressHydrationWarning>
          {date ?? "Not saved yet"}
        </span>
      </div>
    </header>
  );
}

/** Plain-words access for the header field. */
export function accessLabel(opts: {
  shared?: boolean;
  visibility?: "team" | "private" | null;
  publicLink?: boolean;
  locked?: boolean;
}): string {
  if (opts.shared) return "Shared link";
  const who = opts.visibility === "private" ? "Only me" : "Team";
  const parts = [who];
  if (opts.publicLink) parts.push("public link");
  if (opts.locked) parts.push("locked");
  return parts.join(" · ");
}
