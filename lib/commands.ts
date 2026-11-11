import { ReactNode, useSyncExternalStore } from "react";

/**
 * Commands that pages add to the command palette while they're on screen
 * (e.g. the editor's "Export PDF", or the current note's headings).
 */
export type PageCommand = {
  id: string;
  group: "This note" | "Contents";
  label: string;
  hint?: string;
  keywords?: string;
  icon?: ReactNode;
  /** Indent for heading levels in "Contents". */
  depth?: number;
  run: () => void;
};

let commands: PageCommand[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Replace every command owned by `owner`. Returns a cleanup that removes them. */
export function registerCommands(owner: string, list: PageCommand[]): () => void {
  const prefix = `${owner}:`;
  commands = [...commands.filter((c) => !c.id.startsWith(prefix)), ...list.map((c) => ({ ...c, id: prefix + c.id }))];
  emit();
  return () => {
    commands = commands.filter((c) => !c.id.startsWith(prefix));
    emit();
  };
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: PageCommand[] = [];

export function usePageCommands(): PageCommand[] {
  return useSyncExternalStore(subscribe, () => commands, () => EMPTY);
}

export const OPEN_PALETTE_EVENT = "hrleaf:palette";
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
