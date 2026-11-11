/** Shared bits for callout and toggle blocks, used by the editor and the read-only renderer. */

export const CALLOUT_VARIANTS = ["note", "tip", "warning", "danger"] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export const CALLOUT_LABELS: Record<CalloutVariant, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  danger: "Important",
};

export const isCalloutVariant = (v: unknown): v is CalloutVariant =>
  typeof v === "string" && (CALLOUT_VARIANTS as readonly string[]).includes(v);

export const nextCalloutVariant = (v: CalloutVariant): CalloutVariant =>
  CALLOUT_VARIANTS[(CALLOUT_VARIANTS.indexOf(v) + 1) % CALLOUT_VARIANTS.length];

const svg = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

/** Static, trusted SVG markup (no user input). */
export const CALLOUT_ICONS: Record<CalloutVariant, string> = {
  note: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  tip: svg(
    '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  ),
  warning: svg(
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  ),
  danger: svg(
    '<path d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  ),
};

export const CHEVRON_ICON = svg('<path d="m9 18 6-6-6-6"/>');
