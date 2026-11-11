"use client";

import { useEffect } from "react";

const WRAPPER = ".editor-table-scrollable-wrapper";

/** Marks which side of a wide table has more columns hidden, so CSS can fade that edge. */
function update(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth;
  const left = el.scrollLeft > 1;
  const right = max > 1 && el.scrollLeft < max - 1;
  const value = left && right ? "both" : left ? "left" : right ? "right" : "";
  if ((el.dataset.overflow ?? "") === value) return;
  if (value) el.dataset.overflow = value;
  else delete el.dataset.overflow;
}

/**
 * Watches every table wrapper on the page (editor, read-only views, share links).
 * Runs on resize, sideways scroll and when tables are added or edited.
 */
export default function TableOverflowHints() {
  useEffect(() => {
    const observed = new WeakSet<Element>();
    const resize = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const wrapper = (entry.target as HTMLElement).closest<HTMLElement>(WRAPPER);
        if (wrapper) update(wrapper);
      }
    });

    let frame = 0;
    const scan = () => {
      frame = 0;
      document.querySelectorAll<HTMLElement>(WRAPPER).forEach((wrapper) => {
        const table = wrapper.querySelector("table");
        for (const el of [wrapper, table]) {
          if (el && !observed.has(el)) {
            observed.add(el);
            resize.observe(el);
          }
        }
        update(wrapper);
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan);
    };

    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true });

    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.matches(WRAPPER)) update(target);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    scan();

    return () => {
      mutations.disconnect();
      resize.disconnect();
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
