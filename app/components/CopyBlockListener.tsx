"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { copyRich } from "@/lib/rich-copy";

const DONE_MS = 1600;

/**
 * Handles every copy block's Copy button on the page: in the editor, read-only
 * views and share links. Copies the block's contents with formatting.
 */
export default function CopyBlockListener() {
  useEffect(() => {
    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLElement>(".editor-copyblock-copy");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      const body = button.closest(".editor-copyblock")?.querySelector(":scope > .editor-copyblock-body");
      if (!body) return;
      const ok = await copyRich(body);
      if (!ok) {
        toast.error("Couldn't copy. Select the text and copy it instead.");
        return;
      }
      const label = button.querySelector(".editor-copyblock-copy-text");
      button.dataset.copied = "";
      if (label) label.textContent = "Copied";
      window.setTimeout(() => {
        delete button.dataset.copied;
        if (label) label.textContent = "Copy";
      }, DONE_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
