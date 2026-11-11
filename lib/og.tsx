import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { markSvg } from "@/app/components/Logo";

export const OG_SIZE = { width: 1200, height: 630 };

const C = {
  room: "#121110",
  raised: "#1a1917",
  ink: "#ece8e1",
  muted: "#a29d94",
  faint: "#6f6a62",
  leaf: "#4cc47e",
  hairline: "#2a2825",
};

let fontsPromise: Promise<{ name: string; data: Buffer; weight: 400 | 500 | 600; style: "normal" }[]> | null = null;

function fonts() {
  fontsPromise ??= Promise.all(
    (
      [
        ["Geist", "Geist-Regular.ttf", 400],
        ["Geist", "Geist-SemiBold.ttf", 600],
        ["Geist Mono", "GeistMono-Medium.ttf", 500],
        ["Geist Mono", "GeistMono-SemiBold.ttf", 600],
      ] as const
    ).map(async ([name, file, weight]) => ({
      name,
      weight,
      style: "normal" as const,
      data: await readFile(join(process.cwd(), "assets/fonts", file)),
    })),
  );
  return fontsPromise;
}

const markUri = (color: string) =>
  `data:image/svg+xml;base64,${Buffer.from(markSvg(color)).toString("base64")}`;

/** Fit long names: shrink the type as the name grows. */
function nameSize(text: string) {
  const n = text.length;
  if (n <= 10) return 112;
  if (n <= 16) return 96;
  if (n <= 24) return 76;
  if (n <= 34) return 60;
  return 48;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background: C.room,
        fontFamily: "Geist",
        color: C.ink,
        overflow: "hidden",
      }}
    >
      {/* Oversized mark bleeding off the right edge, one step above the background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={markUri(C.raised)}
        width={720}
        height={720}
        style={{ position: "absolute", right: -170, top: -45 }}
        alt=""
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "68px 76px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Brand({ size = 34 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.42 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={markUri(C.leaf)} width={size * 1.25} height={size * 1.25} alt="" />
      <div style={{ display: "flex", fontSize: size, letterSpacing: "-0.02em" }}>
        <span style={{ color: C.muted, fontWeight: 400 }}>HR</span>
        <span style={{ color: C.ink, fontWeight: 600 }}>Leaf</span>
      </div>
    </div>
  );
}

function Meta({ items }: { items: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 28, color: C.muted }}>
      {items.map((item, i) => (
        <div key={item} style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {i > 0 ? <span style={{ color: C.faint }}>·</span> : null}
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

/** A note's address, set like the mark: the slash in leaf green. */
function Address({ slug, suffix }: { slug: string; suffix?: string }) {
  const size = nameSize(slug + (suffix ?? ""));
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        fontFamily: "Geist Mono",
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "-0.03em",
        lineHeight: 1.05,
        maxWidth: 1000,
      }}
    >
      <span style={{ color: C.leaf }}>/</span>
      <span style={{ color: C.ink, wordBreak: "break-all" }}>{slug}</span>
      {suffix ? <span style={{ color: C.faint }}>{suffix}</span> : null}
    </div>
  );
}

export async function noteImage(opts: { slug: string; meta: string[]; view?: boolean }) {
  return new ImageResponse(
    (
      <Frame>
        <Brand />
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <Address slug={opts.slug} suffix={opts.view ? "/view" : undefined} />
          <Meta items={opts.meta} />
        </div>
        <div style={{ display: "flex", fontSize: 24, color: C.faint }}>
          {opts.view ? "Read-only view · private note" : "Private note"}
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}

export async function pageImage(opts: { title: string; subtitle: string }) {
  return new ImageResponse(
    (
      <Frame>
        <Brand />
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 860 }}>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1 }}>
            {opts.title}
          </div>
          <div style={{ display: "flex", fontSize: 32, color: C.muted, lineHeight: 1.35 }}>{opts.subtitle}</div>
        </div>
        <div style={{ display: "flex", width: 120, height: 4, borderRadius: 2, background: C.leaf }} />
      </Frame>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}

export async function brandImage(tagline: string) {
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <Brand size={84} />
          <div style={{ display: "flex", fontSize: 36, color: C.muted, lineHeight: 1.35, maxWidth: 760 }}>
            {tagline}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Geist Mono", fontWeight: 500, fontSize: 28 }}>
          <span style={{ color: C.faint }}>hrleaf</span>
          <span style={{ color: C.leaf }}>/</span>
          <span style={{ color: C.muted }}>your-note</span>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await fonts() },
  );
}
