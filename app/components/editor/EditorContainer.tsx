"use client";

import { $convertToMarkdownString } from "@lexical/markdown";
import { $isHeadingNode } from "@lexical/rich-text";
import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getRoot,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  EditorState,
  LexicalEditor,
  REDO_COMMAND,
  UNDO_COMMAND,
} from "lexical";
import {
  Check,
  ChevronDown,
  Clock,
  CloudOff,
  Download,
  Eye,
  FileText,
  Globe,
  Hash,
  History,
  Link2,
  Loader2,
  Lock,
  MoreHorizontal,
  Plus,
  Printer,
  Redo2,
  Settings2,
  Share2,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useDebounce } from "@/app/hooks";
import { useOnline } from "@/app/hooks/useOnline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { registerCommands } from "@/lib/commands";
import { isDocumentContentEmpty } from "@/lib/content";
import {
  RecentNote,
  clearDraft,
  clearRecent,
  readDraft,
  readPref,
  recordRecent,
  writeDraft,
  writePref,
} from "@/lib/recent";
import { restorePrevious, saveDocument, saveSharedDocument } from "@/server/document-actions";
import { ShareLink, Visibility } from "@/types";

import NewNoteDialog from "../NewNoteDialog";
import NoteFields, { accessLabel } from "../NoteFields";
import PaletteButton from "../PaletteButton";
import ShareDialog, { copyText, shareUrl } from "../ShareDialog";
import SiteHeader from "../SiteHeader";
import UserMenu, { ViewerInfo } from "../UserMenu";

import { HRLEAF_TRANSFORMERS } from "./custom-transformers/HRLeafTransformers";
import Editor from "./Editor";
import TableOfContents, { Heading, headingDepth } from "./TableOfContents";

interface EditorContainerProps {
  slug: string;
  initialContent?: string | null;
  isReadOnly?: boolean;
  updatedAt: string | null;
  previousUpdatedAt: string | null;
  preview?: ReactNode;
  /** Signed-in person. Null when opened through a public share link. */
  viewer: ViewerInfo | null;
  /** Set when editing through a public "can edit" link. */
  shareToken?: string;
  visibility?: Visibility;
  share?: ShareLink | null;
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string | null): string {
  if (!iso) return "";
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 45) return "just now";
  if (a < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (a < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (a < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const serialise = (state: EditorState) => JSON.stringify(state.toJSON());

export default function EditorContainer({
  slug,
  initialContent = null,
  isReadOnly = false,
  updatedAt,
  previousUpdatedAt,
  preview,
  viewer,
  shareToken,
  visibility: initialVisibility = "team",
  share: initialShare = null,
}: EditorContainerProps) {
  const router = useRouter();
  const isShared = !!shareToken;
  const isAdmin = viewer?.role === "admin";
  const draftKey = shareToken ? `share:${shareToken}` : `note:${slug}`;
  const [access, setAccess] = useState({ share: initialShare, visibility: initialVisibility });
  const [shareOpen, setShareOpen] = useState(false);
  const editorRef = useRef<LexicalEditor | null>(null);

  const [locked, setLocked] = useState(isReadOnly);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [previousAt, setPreviousAt] = useState(previousUpdatedAt);
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [, forceTick] = useState(0);

  const [conflictOpen, setConflictOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);

  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [focusMode, setFocusMode] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [emptyConfirm, setEmptyConfirm] = useState<{ force: boolean } | null>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const online = useOnline();

  // Outline of the note, for the contents rail and the command palette.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    let last = "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    const read = () => {
      const next = editor.getEditorState().read(() =>
        $getRoot()
          .getChildren()
          .filter($isHeadingNode)
          .map((n) => ({ key: n.getKey(), tag: n.getTag(), text: n.getTextContent().trim().slice(0, 120) }))
          .filter((h) => h.text),
      );
      const sig = JSON.stringify(next);
      if (sig !== last) {
        last = sig;
        setHeadings(next);
      }
    };
    read();
    const off = editor.registerUpdateListener(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(read, 250);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [slug]);

  const getHeadingElement = useCallback((key: string) => editorRef.current?.getElementByKey(key) ?? null, []);
  const jumpTo = useCallback((key: string) => {
    const el = editorRef.current?.getElementByKey(key);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, []);

  // "New note…" from the command palette.
  useEffect(() => {
    const onNew = () => setNewOpen(true);
    window.addEventListener("hrleaf:new-note", onNew);
    return () => window.removeEventListener("hrleaf:new-note", onNew);
  }, []);

  // Track undo/redo availability so the header buttons can enable/disable.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    return mergeRegister(
      editor.registerCommand(CAN_UNDO_COMMAND, (v) => (setCanUndo(v), false), COMMAND_PRIORITY_LOW),
      editor.registerCommand(CAN_REDO_COMMAND, (v) => (setCanRedo(v), false), COMMAND_PRIORITY_LOW),
    );
  }, [slug]);

  const baseRef = useRef<string | null>(updatedAt);
  const lastSavedRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ----------------------------- change tracking ----------------------------- */

  // Snapshot what "saved" looks like in the editor's own serialisation.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) lastSavedRef.current = serialise(editor.getEditorState());
    if (!shareToken) setRecent(recordRecent(slug));
    setFocusMode(readPref("focus", false));
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    // Re-render relative times once a minute.
    const t = setInterval(() => forceTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [slug, shareToken]);

  const computeDirty = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || lastSavedRef.current === null) return false;
    return serialise(editor.getEditorState()) !== lastSavedRef.current;
  }, []);

  const recheckDirty = useDebounce(() => setDirty(computeDirty()), 120);

  // Keep unsaved changes on this device so a crash or closed tab doesn't lose them.
  const persistDraft = useDebounce(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (computeDirty()) {
      writeDraft(draftKey, { content: serialise(editor.getEditorState()), base: baseRef.current, at: Date.now() });
    } else {
      clearDraft(draftKey);
    }
  }, 700);

  // Offer back any unsaved changes left from last time.
  useEffect(() => {
    if (locked) return;
    const draft = readDraft(draftKey);
    const editor = editorRef.current;
    if (!draft || !editor) return;
    if (draft.content === lastSavedRef.current) {
      clearDraft(draftKey);
      return;
    }
    const changedSince = (draft.base ?? null) !== (baseRef.current ?? null);
    const id = toast("You have unsaved changes from before", {
      description: `From ${ago(new Date(draft.at).toISOString())}.${
        changedSince ? " The note has been saved since then, so restoring replaces that." : ""
      }`,
      duration: Infinity,
      action: {
        label: "Restore",
        onClick: () => {
          try {
            editor.setEditorState(editor.parseEditorState(draft.content));
            setDirty(computeDirty());
            toast.success("Unsaved changes restored. Save to keep them.", { duration: 2500 });
          } catch {
            toast.error("Those changes couldn't be read.");
            clearDraft(draftKey);
          }
        },
      },
      cancel: { label: "Discard", onClick: () => clearDraft(draftKey) },
    });
    return () => void toast.dismiss(id);
    // Only on first load of this note.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const handleEditorStateChange = useCallback(() => {
    if (locked) return;
    recheckDirty();
    persistDraft();
  }, [locked, recheckDirty, persistDraft]);

  /* ---------------------------------- save ---------------------------------- */

  const save = useCallback(
    async (force = false, allowEmpty = false) => {
      const editor = editorRef.current;
      if (!editor || savingRef.current || locked) return;
      const state = editor.getEditorState();
      const serialised = serialise(state);
      if (!force && serialised === lastSavedRef.current) return;

      // Never wipe a note silently: saving an empty sheet over saved text asks first.
      if (!allowEmpty && isDocumentContentEmpty(state.toJSON())) {
        let hadText = false;
        try {
          hadText = !!lastSavedRef.current && !isDocumentContentEmpty(JSON.parse(lastSavedRef.current));
        } catch {
          hadText = true;
        }
        if (hadText) {
          setEmptyConfirm({ force });
          return;
        }
      }

      savingRef.current = true;
      setSaving(true);
      const result = await (shareToken
        ? saveSharedDocument(shareToken, state.toJSON(), baseRef.current, force)
        : saveDocument(slug, state.toJSON(), baseRef.current, force)
      ).catch(
        () => ({ ok: false as const, reason: "error" as const, message: "Couldn't reach the server." }),
      );
      savingRef.current = false;
      setSaving(false);

      if (result.ok) {
        lastSavedRef.current = serialised;
        baseRef.current = result.updated_at;
        setSavedAt(result.updated_at);
        clearDraft(draftKey);
        setPreviousAt(result.previous_updated_at);
        setDirty(computeDirty());
        setJustSaved(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setJustSaved(false), 1800);
        return;
      }

      switch (result.reason) {
        case "conflict":
          setConflictOpen(true);
          break;
        case "locked":
        case "forbidden":
          setLocked(true);
          toast.error(
            result.reason === "locked"
              ? "This note was locked, so your changes can't be saved."
              : "You no longer have access to this note.",
            { description: "Your changes are kept on this device. Copy anything you need.", duration: 10_000 },
          );
          break;
        case "signed-out":
          toast.error("You were signed out, so this wasn't saved.", {
            description: "Your changes are kept on this device. Sign in, and they'll be offered back.",
            duration: Infinity,
            action: {
              label: "Sign in",
              onClick: () => {
                allowLeaveRef.current = true;
                window.location.href = `/login?next=${encodeURIComponent(`/${slug}`)}`;
              },
            },
          });
          break;
        default:
          toast.error(`Not saved. ${result.message}`, {
            action: { label: "Retry", onClick: () => void save(force) },
          });
      }
    },
    [slug, shareToken, draftKey, locked, computeDirty],
  );

  /* ------------------------------ keyboard & tab ----------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (locked) {
          toast("This note is read only.");
          return;
        }
        if (!computeDirty()) {
          toast("Nothing new to save.", { duration: 1500 });
          return;
        }
        void save();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!allowLeaveRef.current && computeDirty()) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [save, locked, computeDirty]);

  // Unsaved marker in the browser tab.
  useEffect(() => {
    const title = `${slug} · HRLeaf`;
    document.title = dirty ? `● ${title}` : title;
  }, [dirty, slug]);

  /* -------------------------------- focus mode ------------------------------- */

  useEffect(() => {
    if (!focusMode) {
      setTyping(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.key.length > 1) return;
      const root = editorRef.current?.getRootElement();
      if (root && root.contains(document.activeElement)) setTyping(true);
    };
    const onMove = () => setTyping(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMove);
    };
  }, [focusMode]);

  const toggleFocus = (on: boolean) => {
    setFocusMode(on);
    writePref("focus", on);
    toast(on ? "Focus mode on" : "Focus mode off", {
      description: on ? "The header hides while you type. Move the mouse to bring it back." : undefined,
      duration: 2200,
    });
  };

  /* -------------------------------- navigation ------------------------------- */

  const navigate = (href: string) => {
    if (!locked && computeDirty()) {
      setLeaveTo(href);
      return;
    }
    allowLeaveRef.current = true;
    router.push(href);
  };

  const leave = async (saveFirst: boolean) => {
    const href = leaveTo;
    if (!href) return;
    if (saveFirst) {
      await save();
      if (computeDirty()) return; // save failed or conflicted; stay put
    }
    setLeaveTo(null);
    allowLeaveRef.current = true;
    router.push(href);
  };

  /* --------------------------------- restore --------------------------------- */

  const applyContent = (content: object | null) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (content) {
      editor.setEditorState(editor.parseEditorState(JSON.stringify(content)));
    } else {
      editor.update(
        () => {
          const root = $getRoot();
          root.clear();
          root.append($createParagraphNode());
        },
        { discrete: true },
      );
    }
    lastSavedRef.current = serialise(editor.getEditorState());
    setDirty(false);
  };

  const doRestore = async (isUndo = false) => {
    setRestoring(true);
    const result = await restorePrevious(slug, baseRef.current).catch(() => ({
      ok: false as const,
      message: "Couldn't reach the server.",
    }));
    setRestoring(false);
    setRestoreOpen(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    applyContent(result.content);
    baseRef.current = result.updated_at;
    setSavedAt(result.updated_at);
    setPreviousAt(result.previous_updated_at);
    toast.success(isUndo ? "Switched back." : "Previous version restored.", {
      description: isUndo ? undefined : "The version you replaced is kept as the previous one.",
      action: { label: "Undo", onClick: () => void doRestore(!isUndo) },
    });
  };

  /* --------------------------------- export --------------------------------- */

  const copy = copyText;

  const downloadMarkdown = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const md = editor.getEditorState().read(() => $convertToMarkdownString(HRLEAF_TRANSFORMERS));
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${slug}.md` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPdf = () => {
    toast("In the print dialog, choose “Save as PDF”.", { duration: 3500 });
    setTimeout(() => window.print(), 300);
  };

  /* ----------------------------------- UI ----------------------------------- */

  const modKey = isMac ? "⌘" : "Ctrl+";

  // Editor actions and headings in the command palette while this note is open.
  const commandsRef = useRef({ downloadMarkdown, exportPdf, toggleFocus, focusMode, save, computeDirty });
  commandsRef.current = { downloadMarkdown, exportPdf, toggleFocus, focusMode, save, computeDirty };
  useEffect(() => {
    const c = () => commandsRef.current;
    const icon = (I: typeof Download) => <I className="h-4 w-4" aria-hidden />;
    return registerCommands("editor", [
      ...(locked
        ? []
        : [
            {
              id: "save",
              group: "This note" as const,
              label: "Save",
              hint: `${modKey}S`,
              icon: icon(Check),
              run: () => (c().computeDirty() ? void c().save() : toast("Nothing new to save.", { duration: 1500 })),
            },
          ]),
      { id: "md", group: "This note", label: "Download Markdown", keywords: "export md", icon: icon(Download), run: () => c().downloadMarkdown() },
      { id: "pdf", group: "This note", label: "Export PDF", keywords: "print", icon: icon(Printer), run: () => c().exportPdf() },
      {
        id: "focus",
        group: "This note",
        label: focusMode ? "Turn off focus mode" : "Turn on focus mode",
        keywords: "zen distraction",
        icon: icon(Eye),
        run: () => c().toggleFocus(!c().focusMode),
      },
      ...(isShared
        ? []
        : [
            {
              id: "copy",
              group: "This note" as const,
              label: "Copy link",
              keywords: "share url",
              icon: icon(Link2),
              run: () => void copy(`${location.origin}/${slug}`, "Link copied"),
            },
          ]),
      ...(isAdmin
        ? [{ id: "share", group: "This note" as const, label: "Share settings…", keywords: "public link only me team", icon: icon(Settings2), run: () => setShareOpen(true) }]
        : []),
      ...headings.map((h) => ({
        id: `h:${h.key}`,
        group: "Contents" as const,
        label: h.text,
        keywords: "heading section jump",
        depth: headingDepth(h.tag),
        icon: icon(Hash),
        run: () => jumpTo(h.key),
      })),
    ]);
  }, [headings, locked, focusMode, isShared, isAdmin, slug, modKey, jumpTo, copy]);
  const headerHidden = focusMode && typing;
  const otherRecent = recent.filter((r) => r.slug !== slug);

  return (
    <div className="editor-main">
      <div
        className={`sticky top-0 z-30 transition-[opacity,transform] duration-200 ease-out print:hidden ${
          headerHidden ? "pointer-events-none -translate-y-1 opacity-0" : "opacity-100"
        }`}
      >
        <SiteHeader
          sticky={false}
          onNavigate={navigate}
          homeHref={isShared ? `/s/${shareToken}` : "/"}
          trail={
            isShared ? (
              <div className="flex min-w-0 items-center gap-2 px-1.5">
                <span className="truncate font-mono text-[13px] text-[--text-secondary]">{slug}</span>
                {dirty && !locked ? (
                  <span aria-label="Unsaved changes" title="Unsaved changes" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[--leaf]" />
                ) : null}
                <span className="hidden shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-px text-[11px] text-[--text-secondary] sm:flex">
                  <Globe className="h-3 w-3" aria-hidden /> Shared
                </span>
              </div>
            ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="group flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors duration-150 hover:bg-accent data-[state=open]:bg-accent"
                aria-label={`${slug}. Open recent notes`}
              >
                <span className="truncate font-mono text-[13px] text-[--text-secondary] group-hover:text-foreground">
                  {slug}
                </span>
                {dirty && !locked ? (
                  <span aria-label="Unsaved changes" title="Unsaved changes" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[--leaf]" />
                ) : null}
                {isAdmin && access.visibility === "private" ? (
                  <Lock className="h-3 w-3 shrink-0 text-[--text-tertiary]" aria-label="Only you can see this note" />
                ) : null}
                {isAdmin && access.share ? (
                  <Globe className="h-3 w-3 shrink-0 text-[--leaf-strong]" aria-label="Has a public share link" />
                ) : null}
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[--text-tertiary]" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Recent notes</DropdownMenuLabel>
                {otherRecent.length === 0 ? (
                  <p className="px-2 pb-2 text-[13px] text-[--text-tertiary]">Notes you open on this device show up here.</p>
                ) : (
                  otherRecent.map((r) => (
                    <DropdownMenuItem key={r.slug} onSelect={() => navigate(`/${r.slug}`)} className="gap-2">
                      <Clock className="h-3.5 w-3.5 text-[--text-tertiary]" aria-hidden />
                      <span className="truncate font-mono text-[13px]">{r.slug}</span>
                      <span className="ml-auto shrink-0 text-[12px] text-[--text-tertiary]">{ago(new Date(r.at).toISOString())}</span>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setNewOpen(true)} className="gap-2">
                  <Plus className="h-3.5 w-3.5" aria-hidden /> New note
                </DropdownMenuItem>
                {otherRecent.length ? (
                  <DropdownMenuItem
                    onSelect={() => {
                      clearRecent();
                      setRecent(recordRecent(slug));
                    }}
                    className="gap-2 text-muted-foreground"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Clear recent
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            )
          }
        >
          {locked ? null : (
            <div className="flex items-center" role="group" aria-label="History">
              <HistoryButton
                label={`Undo (${modKey}Z)`}
                disabled={!canUndo}
                onClick={() => editorRef.current?.dispatchCommand(UNDO_COMMAND, undefined)}
              >
                <Undo2 className="h-4 w-4" aria-hidden />
              </HistoryButton>
              <HistoryButton
                label={`Redo (${isMac ? "⌘⇧Z" : "Ctrl+Y"})`}
                disabled={!canRedo}
                onClick={() => editorRef.current?.dispatchCommand(REDO_COMMAND, undefined)}
              >
                <Redo2 className="h-4 w-4" aria-hidden />
              </HistoryButton>
            </div>
          )}

          {online ? null : (
            <span
              role="status"
              title="You're offline. Changes stay on this device; save when you're back online."
              className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-[--warn-text]"
            >
              <CloudOff className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}

          {locked ? (
            <span className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-[--text-secondary]">
              <Lock className="h-3.5 w-3.5" aria-hidden />
              Read only
            </span>
          ) : (
            <SaveButton
              dirty={dirty}
              saving={saving}
              justSaved={justSaved}
              modKey={modKey}
              // Hand focus back to the text so typing continues right after a click-save.
              onSave={() => void save().then(() => editorRef.current?.focus())}
            />
          )}

          {/* Share (folds into the More menu on phones) */}
          {isShared ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger className="hidden h-8 items-center justify-center gap-1.5 rounded-md px-2 text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent sm:flex" aria-label="Share">
              <Share2 className="h-4 w-4" aria-hidden />
              <span className="hidden text-[13px] sm:inline">Share</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {isAdmin ? (
                <>
                  <DropdownMenuItem className="gap-2" onSelect={() => setShareOpen(true)}>
                    <Settings2 className="h-4 w-4" aria-hidden />
                    <div className="flex flex-col">
                      <span>Share settings…</span>
                      <span className="text-[12px] text-muted-foreground">
                        {access.share
                          ? `Public link on · ${access.share.mode === "write" ? "can edit" : "read only"}`
                          : access.visibility === "private"
                            ? "Only you · no public link"
                            : "Team · no public link"}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  {access.share ? (
                    <DropdownMenuItem className="gap-2" onSelect={() => copy(shareUrl(access.share!.token), "Public link copied")}>
                      <Globe className="h-4 w-4" aria-hidden />
                      <div className="flex flex-col">
                        <span>Copy public link</span>
                        <span className="text-[12px] text-muted-foreground">No account needed</span>
                      </div>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem className="gap-2" onSelect={() => copy(`${location.origin}/${slug}`, "Link copied")}>
                <Link2 className="h-4 w-4" aria-hidden />
                <div className="flex flex-col">
                  <span>Copy link</span>
                  <span className="text-[12px] text-muted-foreground">
                    {access.visibility === "private" ? "Only you can open it" : "Works for signed-in members"}
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={() => window.open(`/${slug}/view`, "_blank", "noopener")}>
                <FileText className="h-4 w-4" aria-hidden /> Open read-only view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}

          {/* More */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 w-8 items-center justify-center rounded-md text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent" aria-label="More options">
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {isShared ? (
                <DropdownMenuItem className="gap-2" onSelect={() => copy(location.href, "Link copied")}>
                  <Link2 className="h-4 w-4" aria-hidden /> Copy link
                </DropdownMenuItem>
              ) : (
                <>
                  {isAdmin ? (
                    <DropdownMenuItem className="gap-2 sm:hidden" onSelect={() => setShareOpen(true)}>
                      <Settings2 className="h-4 w-4" aria-hidden /> Share settings…
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem className="gap-2 sm:hidden" onSelect={() => copy(`${location.origin}/${slug}`, "Link copied")}>
                    <Link2 className="h-4 w-4" aria-hidden /> Copy link
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2 sm:hidden" onSelect={() => window.open(`/${slug}/view`, "_blank", "noopener")}>
                    <Eye className="h-4 w-4" aria-hidden /> Open read-only view
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="sm:hidden" />
                  <DropdownMenuItem
                    className="gap-2"
                    disabled={!previousAt || locked}
                    onSelect={() => setRestoreOpen(true)}
                  >
                    <History className="h-4 w-4" aria-hidden />
                    <div className="flex flex-col">
                      <span>Restore previous version</span>
                      <span className="text-[12px] text-muted-foreground">
                        {locked ? "Unavailable while locked" : previousAt ? `Saved ${ago(previousAt)}` : "Appears after your second save"}
                      </span>
                    </div>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onSelect={downloadMarkdown}>
                <Download className="h-4 w-4" aria-hidden /> Download Markdown
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onSelect={exportPdf}>
                <Printer className="h-4 w-4" aria-hidden /> Export PDF
                <DropdownMenuShortcut>{modKey}P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={focusMode} onCheckedChange={(v) => toggleFocus(!!v)}>
                Focus mode
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {viewer ? (
            <>
              <PaletteButton className="hidden sm:flex" />
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                // On phones, "New note" lives in the note-name menu to leave room for the name.
                className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground sm:flex"
                aria-label="New note"
                title="New note"
              >
                <Plus className="h-4 w-4" aria-hidden />
                <span className="hidden md:inline">New</span>
              </button>
              <UserMenu viewer={viewer} className="ml-0.5" />
            </>
          ) : null}
        </SiteHeader>
      </div>

      <TableOfContents headings={headings} getElement={getHeadingElement} onJump={jumpTo} hidden={headerHidden} />

      <main id="main" className="flex flex-grow flex-col">
      <Editor
        key={slug}
        editorRef={editorRef}
        initialContent={initialContent}
        editable={!locked}
        onEditorStateChange={handleEditorStateChange}
        preview={preview}
        header={
          <NoteFields
            name={slug}
            updatedAt={savedAt}
            access={accessLabel({
              shared: isShared,
              visibility: access.visibility,
              publicLink: !!access.share,
              locked,
            })}
          />
        }
      />
      </main>

      {viewer ? <NewNoteDialog open={newOpen} onOpenChange={setNewOpen} onNavigate={navigate} /> : null}
      {isAdmin ? (
        <ShareDialog
          slug={slug}
          share={access.share}
          visibility={access.visibility}
          open={shareOpen}
          onOpenChange={setShareOpen}
          onChange={setAccess}
        />
      ) : null}

      {/* Unsaved changes on navigation */}
      <AlertDialog open={leaveTo !== null} onOpenChange={(o) => !o && setLeaveTo(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes before leaving?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in <span className="font-mono text-foreground">{slug}</span>. If you leave without saving, they&apos;re gone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <button
              type="button"
              onClick={() => void leave(false)}
              className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-[--danger-text] transition-colors hover:bg-destructive/15"
            >
              Discard
            </button>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void leave(true);
              }}
              disabled={saving}
              className="bg-[--leaf] text-[--on-leaf] hover:bg-[--leaf-hover]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore previous version */}
      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore the previous version?</AlertDialogTitle>
            <AlertDialogDescription>
              This brings back the version saved {ago(previousAt)}. What&apos;s saved now becomes the previous version, so you can switch back.
              {dirty ? (
                <span className="mt-2 block text-[--warn-text]">Your unsaved changes will be discarded.</span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doRestore();
              }}
              disabled={restoring}
            >
              {restoring ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Saving would empty a note that has text */}
      <AlertDialog open={emptyConfirm !== null} onOpenChange={(o) => !o && setEmptyConfirm(null)}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Save this note empty?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything in <span className="font-mono text-foreground">{slug}</span> has been deleted. If you save, the
              note becomes empty. The text you had is kept as the previous version, so you can restore it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const force = emptyConfirm?.force ?? false;
                setEmptyConfirm(null);
                void save(force, true);
              }}
            >
              Save empty note
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save conflict */}
      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>This note changed somewhere else</AlertDialogTitle>
            <AlertDialogDescription>
              Someone saved a newer version after you opened it. Keep yours and replace theirs, or load theirs and lose your unsaved changes. Either way, the replaced version can be brought back with Restore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={() => {
                allowLeaveRef.current = true;
                window.location.reload();
              }}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-accent"
            >
              Load theirs
            </button>
            <AlertDialogAction
              onClick={() => {
                setConflictOpen(false);
                void save(true);
              }}
            >
              Keep mine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HistoryButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      // Keep the caret where it is so undo acts on the text, and the phone keyboard stays up.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:text-[--text-disabled]"
    >
      {children}
    </button>
  );
}

function SaveButton({
  dirty,
  saving,
  justSaved,
  modKey,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
  modKey: string;
  onSave: () => void;
}) {
  const state = saving ? "saving" : dirty ? "dirty" : justSaved ? "saved" : "clean";
  const label = { saving: "Saving…", dirty: "Save", saved: "Saved", clean: "Save" }[state];

  return (
    <>
      <button
        type="button"
        onClick={onSave}
        disabled={state !== "dirty"}
        aria-keyshortcuts={modKey === "⌘" ? "Meta+S" : "Control+S"}
        title={state === "dirty" ? `Save (${modKey}S)` : state === "clean" ? "No unsaved changes" : undefined}
        className={`save-button flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease-out ${
          state === "dirty"
            ? "bg-[--leaf] text-[--on-leaf] shadow-[--shadow-leaf] hover:bg-[--leaf-hover] active:scale-[0.98]"
            : state === "saving"
              ? "cursor-progress bg-[--primary-20] text-[--leaf-strong]"
              : state === "saved"
                ? "text-[--leaf-strong]"
                : "cursor-default text-[--text-disabled]"
        }`}
      >
        {state === "saving" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : state === "saved" ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : null}
        {label}
        {state === "dirty" ? (
          <kbd className="ml-0.5 hidden rounded bg-black/15 px-1 font-sans text-[11px] font-medium leading-4 text-[--on-leaf] opacity-75 sm:inline">
            {modKey}S
          </kbd>
        ) : null}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === "saved" ? "All changes saved" : state === "saving" ? "Saving" : ""}
      </span>
    </>
  );
}
