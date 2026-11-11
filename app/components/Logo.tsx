/**
 * HRLeaf brand mark: one solid leaf, one cut.
 * The cut is both the leaf's midrib and the "/" of a note's address (hrleaf/your-note).
 * Drawn on a 100 grid: leaf with sharp tip (top-right) and stem (bottom-left),
 * channel 9 wide (≈9%) running from the stem towards the tip.
 */

export const LEAF_PATH = "M50 4H96V50A46 46 0 0 1 50 96H4V50A46 46 0 0 1 50 4Z";
export const CUT_PATH = "M4 96 70 30";

export function LogoMark({
  size = 22,
  color = "var(--leaf)",
  className,
  title,
}: {
  size?: number;
  color?: string;
  className?: string;
  title?: string;
}) {
  // Identical definitions share one id safely; the mask is the same everywhere.
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <mask id="hrleaf-cut">
          <path d={LEAF_PATH} fill="#fff" />
          <path d={CUT_PATH} stroke="#000" strokeWidth={9} strokeLinecap="round" />
        </mask>
      </defs>
      <rect width="100" height="100" fill={color} mask="url(#hrleaf-cut)" />
    </svg>
  );
}

/** Wordmark: "HR" light, "Leaf" strong, same family. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`tracking-[-0.02em] ${className}`}>
      <span className="font-normal text-[--text-secondary]">HR</span>
      <span className="font-semibold text-foreground">Leaf</span>
    </span>
  );
}

/** Raw SVG string (for OG images and other non-DOM uses). */
export function markSvg(color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><mask id="m"><path d="${LEAF_PATH}" fill="#fff"/><path d="${CUT_PATH}" stroke="#000" stroke-width="9" stroke-linecap="round"/></mask></defs><rect width="100" height="100" fill="${color}" mask="url(#m)"/></svg>`;
}
