"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminStats, StorageInfo } from "@/types";

type Series = "created" | "edited";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDay = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const W = 600;
const H = 120;
const GAP = 2;
const TOP = 14;

/** Bars with a 4px rounded data-end, anchored square to the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${H}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${H}Z`;
}

export default function ActivityPanel({ stats, storage }: { stats: AdminStats; storage: StorageInfo }) {
  const [series, setSeries] = useState<Series>("edited");
  const [hover, setHover] = useState<number | null>(null);

  const values = stats.days.map((d) => d[series]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const slot = W / values.length;
  const barW = slot - GAP;
  const maxLargest = Math.max(1, ...stats.largest.map((l) => l.size));

  const label = series === "created" ? "created" : "edited";
  const ticks = useMemo(() => [0, 14, 29], []);

  return (
    <section
      aria-label="Activity"
      className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start"
    >
      {/* Activity chart */}
      <div className="panel p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Notes {label} per day</h2>
            <p className="tabular mt-0.5 text-[13px] text-muted-foreground">
              {total} in the last 30 days
            </p>
          </div>
          <div role="radiogroup" aria-label="Series" className="flex h-8 items-center gap-0.5 rounded-lg border border-border bg-[--surface-dark] p-0.5">
            {(["edited", "created"] as const).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={series === s}
                onClick={() => setSeries(s)}
                className={`h-full rounded-md px-2.5 text-[12px] capitalize transition-colors duration-150 ${
                  series === s ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-7" onMouseLeave={() => setHover(null)}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-[120px] w-full overflow-visible"
            role="img"
            aria-label={`Bar chart of notes ${label} per day over the last 30 days. Peak ${max}.`}
          >
            {/* recessive gridline at the max */}
            <line x1={0} x2={W} y1={TOP} y2={TOP} stroke="hsl(var(--border))" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
            <line x1={0} x2={W} y1={H} y2={H} stroke="hsl(var(--border))" vectorEffect="non-scaling-stroke" />
            {values.map((v, i) => {
              const h = v === 0 ? 0 : Math.max(2, ((H - TOP) * v) / max);
              const x = i * slot + GAP / 2;
              return (
                <g key={i}>
                  {h > 0 ? (
                    <path
                      d={barPath(x, H - h, barW, h)}
                      fill="var(--leaf)"
                      opacity={hover === null || hover === i ? 1 : 0.45}
                      className="transition-opacity duration-150"
                    />
                  ) : null}
                  {/* hit target: full column, larger than the bar */}
                  <rect
                    x={i * slot}
                    y={0}
                    width={slot}
                    height={H}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                  />
                </g>
              );
            })}
          </svg>
          <span className="tabular pointer-events-none absolute left-0 top-0 -translate-y-[calc(100%+2px)] text-[11px] leading-none text-[--text-tertiary]">
            {max}
          </span>

          {hover !== null ? (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[12px] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.6)]"
              style={{
                left: `${((hover + 0.5) / values.length) * 100}%`,
                // Keep the tooltip inside the card near either edge.
                transform: `translateX(${hover < 4 ? "-15%" : hover > values.length - 5 ? "-85%" : "-50%"}) translateY(calc(-100% - 6px))`,
              }}
            >
              <span className="text-muted-foreground">{fmtDay(stats.days[hover].date)}</span>{" "}
              <span className="tabular font-medium text-foreground">{values[hover]}</span>{" "}
              <span className="text-muted-foreground">{label}</span>
            </div>
          ) : null}

          <div className="relative mt-2 h-4 text-[11px] text-[--text-tertiary]">
            {ticks.map((t) => (
              <span
                key={t}
                className="tabular absolute whitespace-nowrap"
                style={{
                  left: `${((t + 0.5) / values.length) * 100}%`,
                  transform: t === 0 ? "translateX(-25%)" : t === 29 ? "translateX(-75%)" : "translateX(-50%)",
                }}
              >
                {fmtDay(stats.days[t].date)}
              </span>
            ))}
          </div>
        </div>

        {/* Accessible data table */}
        <table className="sr-only">
          <caption>Notes {label} per day</caption>
          <thead>
            <tr><th>Date</th><th>Count</th></tr>
          </thead>
          <tbody>
            {stats.days.map((d) => (
              <tr key={d.date}><td>{d.date}</td><td>{d[series]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Storage + largest notes */}
      <div className="panel flex flex-col p-4 sm:p-5">
        <StorageMeter storage={storage} />
        <div className="mb-4 mt-6">
          <h2 className="text-sm font-medium">Largest notes</h2>
          <p className="tabular mt-0.5 text-[13px] text-muted-foreground">
            {formatBytes(stats.totalSize)} of note text in total
          </p>
        </div>
        {stats.largest.length === 0 ? (
          <p className="text-[13px] text-[--text-tertiary]">No notes yet.</p>
        ) : (
          <ol className="flex flex-col gap-2.5">
            {stats.largest.map((l) => (
              <li key={l.slug} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <Link href={`/${l.slug}`} className="truncate font-mono text-foreground underline-offset-4 hover:underline">
                    {l.slug}
                  </Link>
                  <span className="tabular shrink-0 text-muted-foreground">{formatBytes(l.size)}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-[--surface-dark]">
                  <div
                    className="h-full rounded-full bg-[--text-tertiary]"
                    style={{ width: `${Math.max(2, (l.size / maxLargest) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-auto pt-6">
          <a
            href="/ainzooalgown/export"
            download
            className="flex h-9 items-center justify-center gap-2 rounded-lg border border-border text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <Download className="h-4 w-4" aria-hidden /> Download backup (JSON)
          </a>
        </div>
      </div>
    </section>
  );
}

/** How full the Atlas free tier is. The cluster figure includes other databases on it. */
function StorageMeter({ storage }: { storage: StorageInfo }) {
  const used = storage.clusterBytes ?? storage.appBytes;
  const pct = Math.min(100, (used / storage.limitBytes) * 100);
  const appPct = Math.min(pct, (storage.appBytes / storage.limitBytes) * 100);
  const tone = pct > 85 ? "bg-[hsl(2_70%_60%)]" : pct > 65 ? "bg-[hsl(38_90%_60%)]" : "bg-[--leaf]";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Storage</h2>
        <span className="tabular text-[12.5px] text-muted-foreground">
          {formatBytes(used)} of {formatBytes(storage.limitBytes)}
        </span>
      </div>
      <div
        className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-[--surface-dark]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label="Database storage used"
      >
        <div className={`h-full ${tone}`} style={{ width: `${Math.max(1, appPct)}%` }} />
        {storage.clusterBytes ? (
          <div className="h-full bg-[--text-disabled]" style={{ width: `${Math.max(0, pct - appPct)}%` }} />
        ) : null}
      </div>
      <p className="tabular mt-2 text-[12px] leading-relaxed text-[--text-tertiary]">
        HRLeaf uses {formatBytes(storage.appBytes)}
        {storage.clusterBytes ? `; other databases on this cluster use ${formatBytes(Math.max(0, storage.clusterBytes - storage.appBytes))}` : ""}.
      </p>
    </div>
  );
}
