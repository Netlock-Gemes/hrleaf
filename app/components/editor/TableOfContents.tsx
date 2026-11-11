"use client";

import { useEffect, useState } from "react";

export type Heading = { key: string; tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; text: string };

const DEPTH: Record<Heading["tag"], number> = { h1: 0, h2: 1, h3: 2, h4: 2, h5: 2, h6: 2 };
export const headingDepth = (tag: Heading["tag"]) => DEPTH[tag];

/**
 * Outline of the note's headings, pinned beside the sheet on wide screens.
 * The current section is the last heading scrolled past the header.
 */
export default function TableOfContents({
  headings,
  getElement,
  onJump,
  hidden,
}: {
  headings: Heading[];
  getElement: (key: string) => HTMLElement | null;
  onJump: (key: string) => void;
  hidden?: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = headings[0]?.key ?? null;
      for (const h of headings) {
        const el = getElement(h.key);
        if (el && el.getBoundingClientRect().top < 120) current = h.key;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headings, getElement]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="Contents" className={`toc-rail ${hidden ? "toc-rail-hidden" : ""}`}>
      <p className="mb-2 text-[12px] font-medium text-[--text-tertiary]">Contents</p>
      <ol className="flex flex-col">
        {headings.map((h) => {
          const isActive = h.key === active;
          return (
            <li key={h.key}>
              <button
                type="button"
                onClick={() => onJump(h.key)}
                aria-current={isActive ? "location" : undefined}
                style={{ paddingLeft: `${headingDepth(h.tag) * 0.75}rem` }}
                className={`group flex w-full items-start gap-2 rounded-md py-1 pr-1 text-left text-[12.5px] leading-[1.35rem] transition-colors duration-150 ${
                  isActive ? "text-foreground" : "text-[--text-tertiary] hover:text-[--text-secondary]"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-[0.6rem] h-1 w-1 shrink-0 rounded-full transition-colors duration-150 ${
                    isActive ? "bg-[--leaf]" : "bg-transparent"
                  }`}
                />
                <span className="line-clamp-2">{h.text}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
