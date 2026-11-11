'use client';

import { $isCodeNode } from '@lexical/code';
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  BLUR_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  TextFormatType,
} from 'lexical';
import { Bold, Code, Italic, Link2, Link2Off, Strikethrough, Underline } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { validateUrl } from '@/app/utils';

type Formats = Record<'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'link', boolean>;

const EMPTY: Formats = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  link: false,
};

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * A small toolbar that appears above selected text:
 * bold, italic, underline, strikethrough, inline code and links.
 */
export function FloatingFormatToolbarPlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext();
  const [visible, setVisible] = useState(false);
  const [formats, setFormats] = useState<Formats>(EMPTY);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const pointerDown = useRef(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const update = useCallback(() => {
    // While typing a link in the toolbar, focus is in our input: keep it open.
    if (toolbarRef.current?.contains(document.activeElement)) return;
    if (!editor.isEditable() || pointerDown.current) {
      if (!pointerDown.current) setVisible(false);
      return;
    }
    const selection = $getSelection();
    const native = window.getSelection();
    const root = editor.getRootElement();
    if (!root || !root.contains(document.activeElement)) {
      setVisible(false);
      return;
    }

    if (
      !$isRangeSelection(selection) ||
      selection.isCollapsed() ||
      !native ||
      native.rangeCount === 0 ||
      !root ||
      !root.contains(native.anchorNode) ||
      selection.getTextContent().trim() === ''
    ) {
      setVisible(false);
      setLinkMode(false);
      return;
    }

    const anchor = selection.anchor.getNode();
    if ($findMatchingParent(anchor, $isCodeNode)) {
      setVisible(false);
      return;
    }

    const linkParent = $findMatchingParent(anchor, $isLinkNode);
    setFormats({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikethrough: selection.hasFormat('strikethrough'),
      code: selection.hasFormat('code'),
      link: !!linkParent,
    });

    const rect = native.getRangeAt(0).getBoundingClientRect();
    setPos({ top: rect.top, left: rect.left + rect.width / 2 });
    setVisible(true);
  }, [editor]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      pointerDown.current = true;
      setVisible(false);
    };
    const onUp = () => {
      if (!pointerDown.current) return;
      pointerDown.current = false;
      // Let the browser settle the selection first.
      setTimeout(() => editor.getEditorState().read(update), 0);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
    };
  }, [editor, update]);

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => editorState.read(update)),
        // Hide when focus leaves the text (menus, dialogs), unless it moved into our link input.
        editor.registerCommand(
          BLUR_COMMAND,
          () => {
            setTimeout(() => {
              if (!toolbarRef.current?.contains(document.activeElement)) {
                setVisible(false);
                setLinkMode(false);
              }
            }, 0);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            update();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor, update],
  );

  useEffect(() => {
    if (!visible) return;
    const reposition = () => editor.getEditorState().read(update);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [visible, editor, update]);

  // Keep the toolbar inside the viewport.
  const [placed, setPlaced] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!visible || !pos || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(8, pos.left - w / 2), window.innerWidth - w - 8);
    const top = pos.top - h - 10 < 64 ? pos.top + 28 : pos.top - h - 10;
    setPlaced({ top, left });
  }, [visible, pos, linkMode]);

  useEffect(() => {
    if (linkMode) linkInputRef.current?.focus();
  }, [linkMode]);

  if (!visible || typeof document === 'undefined') return null;

  const format = (f: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, f);
  const mod = isMac() ? '⌘' : 'Ctrl+';

  const applyLink = () => {
    let url = linkValue.trim();
    if (!url) return setLinkMode(false);
    if (!/^[a-z]+:/i.test(url)) url = url.includes('@') && !url.includes('/') ? `mailto:${url}` : `https://${url}`;
    if (!validateUrl(url)) return;
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    setLinkMode(false);
    setLinkValue('');
    editor.focus();
  };

  const Btn = ({
    active,
    label,
    onClick,
    children,
  }: {
    active?: boolean;
    label: string;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-100 ${
        active ? 'bg-[--primary-20] text-[--leaf-strong]' : 'text-[--text-secondary] hover:bg-accent hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );

  return createPortal(
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Text formatting"
      className="format-toolbar fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1"
      style={{ top: placed?.top ?? -9999, left: placed?.left ?? -9999 }}
    >
      {linkMode ? (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            ref={linkInputRef}
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setLinkMode(false);
                editor.focus();
              }
            }}
            placeholder="Paste or type a link"
            aria-label="Link address"
            className="h-8 w-56 rounded-md bg-transparent px-2 text-[13px] text-foreground outline-none placeholder:text-[--text-tertiary]"
          />
          <button
            type="submit"
            onMouseDown={(e) => e.preventDefault()}
            className="h-7 rounded-md bg-[--leaf] px-2.5 text-[12px] font-medium text-[--on-leaf] hover:bg-[--leaf-hover]"
          >
            Apply
          </button>
        </form>
      ) : (
        <>
          <Btn label={`Bold (${mod}B)`} active={formats.bold} onClick={() => format('bold')}>
            <Bold className="h-4 w-4" />
          </Btn>
          <Btn label={`Italic (${mod}I)`} active={formats.italic} onClick={() => format('italic')}>
            <Italic className="h-4 w-4" />
          </Btn>
          <Btn label={`Underline (${mod}U)`} active={formats.underline} onClick={() => format('underline')}>
            <Underline className="h-4 w-4" />
          </Btn>
          <Btn label="Strikethrough" active={formats.strikethrough} onClick={() => format('strikethrough')}>
            <Strikethrough className="h-4 w-4" />
          </Btn>
          <Btn label="Inline code" active={formats.code} onClick={() => format('code')}>
            <Code className="h-4 w-4" />
          </Btn>
          <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />
          {formats.link ? (
            <Btn label="Remove link" active onClick={() => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)}>
              <Link2Off className="h-4 w-4" />
            </Btn>
          ) : (
            <Btn label="Add link" onClick={() => setLinkMode(true)}>
              <Link2 className="h-4 w-4" />
            </Btn>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}

export default FloatingFormatToolbarPlugin;
