"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { openCommandPalette } from "@/lib/commands";

/** Opens the command palette. Shows the shortcut on wide screens so it can be learned. */
export default function PaletteButton({ className = "" }: { className?: string }) {
  const [mod, setMod] = useState("Ctrl ");
  useEffect(() => setMod(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl "), []);
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Search notes and commands"
      title={`Search notes and commands (${mod.trim()}${mod === "⌘" ? "" : "+"}K)`}
      className={`flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground ${className}`}
    >
      <Search className="h-4 w-4" aria-hidden />
      <kbd className="kbd hidden lg:inline-flex">{mod}K</kbd>
    </button>
  );
}
