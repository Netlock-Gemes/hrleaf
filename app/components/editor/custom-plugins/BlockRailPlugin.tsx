'use client';

import { $isCodeNode } from '@lexical/code';
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { useLexicalEditable } from '@lexical/react/useLexicalEditable';
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text';
import { $findMatchingParent, $getNearestNodeOfType } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  LexicalEditor,
} from 'lexical';
import {
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Info,
  List,
  ListChecks,
  ListCollapse,
  ListOrdered,
  LucideIcon,
  Pilcrow,
  Quote,
  SeparatorHorizontal,
  SquareSigma,
  Table,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  $createInlineTableInputNode,
  $isCalloutNode,
  $isToggleContainerNode,
} from '../custom-nodes';

import { INSERT_CALLOUT_COMMAND, INSERT_TOGGLE_COMMAND } from './BlocksPlugin';
import { insertCode, insertText, setBlock } from './ComponentPickerPlugin';
import { INSERT_EQUATION_COMMAND } from './EquationPlugin';

type BlockType =
  | 'paragraph' | 'h1' | 'h2' | 'h3' | 'h4' | 'quote' | 'code'
  | 'bullet' | 'number' | 'check' | 'other';

type Item = {
  id: string;
  label: string;
  hint?: string;
  Icon: LucideIcon;
  /** Shown as pressed when the cursor's block (or container) matches. */
  isActive?: (s: RailState) => boolean;
  run: (editor: LexicalEditor, s: RailState) => void;
};

type RailState = { block: BlockType; inCallout: boolean; inToggle: boolean };

const paragraph = (editor: LexicalEditor) => setBlock(editor, () => $createParagraphNode());

/** A block type that switches back to a paragraph when clicked again, like Word's styles. */
const style = (type: BlockType, create: () => ReturnType<typeof $createHeadingNode> | ReturnType<typeof $createQuoteNode>) =>
  (editor: LexicalEditor, s: RailState) => (s.block === type ? paragraph(editor) : setBlock(editor, create));

const list = (type: 'bullet' | 'number' | 'check') => (editor: LexicalEditor, s: RailState) => {
  if (s.block === type) {
    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    return;
  }
  const command =
    type === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : type === 'number' ? INSERT_ORDERED_LIST_COMMAND : INSERT_CHECK_LIST_COMMAND;
  editor.dispatchCommand(command, undefined);
};

const GROUPS: { name: string; items: Item[] }[] = [
  {
    name: 'Text',
    items: [
      { id: 'paragraph', label: 'Paragraph', Icon: Pilcrow, isActive: (s) => s.block === 'paragraph', run: (e) => paragraph(e) },
      { id: 'h1', label: 'Heading 1', hint: '#', Icon: Heading1, isActive: (s) => s.block === 'h1', run: style('h1', () => $createHeadingNode('h1')) },
      { id: 'h2', label: 'Heading 2', hint: '##', Icon: Heading2, isActive: (s) => s.block === 'h2', run: style('h2', () => $createHeadingNode('h2')) },
      { id: 'h3', label: 'Heading 3', hint: '###', Icon: Heading3, isActive: (s) => s.block === 'h3', run: style('h3', () => $createHeadingNode('h3')) },
      { id: 'h4', label: 'Heading 4', hint: '####', Icon: Heading4, isActive: (s) => s.block === 'h4', run: style('h4', () => $createHeadingNode('h4')) },
      { id: 'quote', label: 'Quote', hint: '>', Icon: Quote, isActive: (s) => s.block === 'quote', run: style('quote', () => $createQuoteNode()) },
    ],
  },
  {
    name: 'Lists',
    items: [
      { id: 'bullet', label: 'Bulleted list', hint: '-', Icon: List, isActive: (s) => s.block === 'bullet', run: list('bullet') },
      { id: 'number', label: 'Numbered list', hint: '1.', Icon: ListOrdered, isActive: (s) => s.block === 'number', run: list('number') },
      { id: 'check', label: 'Checklist', hint: '[ ]', Icon: ListChecks, isActive: (s) => s.block === 'check', run: list('check') },
    ],
  },
  {
    name: 'Blocks',
    items: [
      { id: 'callout', label: 'Callout', Icon: Info, isActive: (s) => s.inCallout, run: (e) => e.dispatchCommand(INSERT_CALLOUT_COMMAND, 'note') },
      { id: 'toggle', label: 'Toggle', Icon: ListCollapse, isActive: (s) => s.inToggle, run: (e) => e.dispatchCommand(INSERT_TOGGLE_COMMAND, undefined) },
      {
        id: 'code',
        label: 'Code block',
        hint: '```',
        Icon: Code,
        isActive: (s) => s.block === 'code',
        run: (e, s) => (s.block === 'code' ? paragraph(e) : insertCode(e)),
      },
      {
        id: 'table',
        label: 'Table',
        hint: '/3x4',
        Icon: Table,
        run: (e) =>
          e.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) selection.insertNodes([$createInlineTableInputNode()]);
          }),
      },
      { id: 'divider', label: 'Divider', hint: '---', Icon: SeparatorHorizontal, run: (e) => e.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined) },
    ],
  },
  {
    name: 'Insert',
    items: [
      { id: 'note-link', label: 'Link to note', hint: '[[', Icon: FileText, run: (e) => insertText(e, '[[') },
      {
        id: 'equation',
        label: 'Equation',
        hint: '$$',
        Icon: SquareSigma,
        run: (e) => e.dispatchCommand(INSERT_EQUATION_COMMAND, { equation: '', inline: false, startInEditMode: true }),
      },
    ],
  },
];

function $readState(): RailState {
  const none: RailState = { block: 'other', inCallout: false, inToggle: false };
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return none;
  const node = selection.anchor.getNode();

  const inCallout = !!$findMatchingParent(node, $isCalloutNode);
  const inToggle = !!$findMatchingParent(node, $isToggleContainerNode);

  const listNode = $getNearestNodeOfType(node, ListNode);
  if ($isListNode(listNode)) {
    const t = listNode.getListType();
    return { block: t === 'bullet' ? 'bullet' : t === 'number' ? 'number' : 'check', inCallout, inToggle };
  }

  const block = $findMatchingParent(
    node,
    (n) => $isElementNode(n) && !n.isInline() && $isRootOrShadowRoot(n.getParent()),
  );
  let type: BlockType = 'other';
  if ($isHeadingNode(block)) {
    const tag = block.getTag();
    type = tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' ? tag : 'other';
  } else if ($isQuoteNode(block)) type = 'quote';
  else if ($isCodeNode(block)) type = 'code';
  else if (block && block.getType() === 'paragraph') type = 'paragraph';
  return { block: type, inCallout, inToggle };
}

const BLOCK_NAMES: Record<BlockType, string> = {
  paragraph: 'Paragraph',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  h4: 'Heading 4',
  quote: 'Quote',
  code: 'Code block',
  bullet: 'Bulleted list',
  number: 'Numbered list',
  check: 'Checklist',
  other: '—',
};

/** What the status line says when nothing is hovered: where the cursor is. */
function currentLabel(s: RailState): string {
  const where = s.inCallout ? ' in callout' : s.inToggle ? ' in toggle' : '';
  return `${BLOCK_NAMES[s.block]}${s.block === 'other' ? '' : where}`;
}

/**
 * A slim block toolbar pinned to the left of the sheet on wide screens:
 * the same options as the "/" menu, one click away, with the current block highlighted.
 */
export function BlockRailPlugin({ hidden = false }: { hidden?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const [state, setState] = useState<RailState>({ block: 'paragraph', inCallout: false, inToggle: false });
  const [hovered, setHovered] = useState<Item | null>(null);

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        const next = editorState.read($readState);
        setState((prev) =>
          prev.block === next.block && prev.inCallout === next.inCallout && prev.inToggle === next.inToggle ? prev : next,
        );
      }),
    [editor],
  );

  if (!editable) return null;

  const act = (item: Item) => {
    const run = () => item.run(editor, state);
    // Keep the caret where it was; if the note has no caret yet, put it at the end first.
    const hasSelection = editor.getEditorState().read(() => $isRangeSelection($getSelection()));
    if (hasSelection) run();
    else editor.focus(run);
  };

  return (
    <nav aria-label="Blocks" className={`block-rail ${hidden ? 'block-rail-hidden' : ''}`}>
      {GROUPS.map((group) => (
        <section key={group.name} className="block-rail-group">
          <p className="block-rail-title" id={`block-rail-${group.name}`}>
            {group.name}
          </p>
          <div role="group" aria-labelledby={`block-rail-${group.name}`} className="block-rail-grid">
            {group.items.map((item) => {
              const active = item.isActive?.(state) ?? false;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="block-rail-btn"
                  aria-label={item.label}
                  aria-pressed={item.isActive ? active : undefined}
                  onMouseEnter={() => setHovered(item)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(item)}
                  onBlur={() => setHovered(null)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => act(item)}
                >
                  <item.Icon size={17} strokeWidth={1.75} aria-hidden />
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="block-rail-status" aria-live="polite">
        <span className="truncate">{hovered ? hovered.label : currentLabel(state)}</span>
        {hovered?.hint ? <kbd className="kbd">{hovered.hint}</kbd> : null}
      </p>
    </nav>
  );
}

export default BlockRailPlugin;
