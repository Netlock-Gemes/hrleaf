'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $findMatchingParent, mergeRegister } from '@lexical/utils';
import {
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isRangeSelection,
  $isRootOrShadowRoot,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_LOW,
  createCommand,
  ElementNode,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  LexicalCommand,
  LexicalNode,
} from 'lexical';
import { useEffect } from 'react';

import { CalloutVariant, nextCalloutVariant } from '@/lib/blocks';

import {
  $createCalloutWithParagraph,
  $createToggle,
  $createToggleContentNode,
  $isCalloutNode,
  $isToggleContainerNode,
  $isToggleContentNode,
  $isToggleTitleNode,
  CalloutNode,
  ToggleContainerNode,
  ToggleContentNode,
  ToggleTitleNode,
} from '../custom-nodes';

export const INSERT_CALLOUT_COMMAND: LexicalCommand<CalloutVariant> = createCommand('INSERT_CALLOUT_COMMAND');
export const INSERT_TOGGLE_COMMAND: LexicalCommand<void> = createCommand('INSERT_TOGGLE_COMMAND');

const isBlockContainer = (n: LexicalNode | null): n is ElementNode => $isCalloutNode(n) || $isToggleContainerNode(n);

/** The block the cursor is in, at the level of its nearest root (page, callout or toggle section). */
function $currentBlock(): ElementNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return null;
  const node = selection.anchor.getNode();
  return $findMatchingParent(
    node,
    (n) => $isElementNode(n) && !n.isInline() && $isRootOrShadowRoot(n.getParent()),
  ) as ElementNode | null;
}

/** Puts a block where the cursor is: replaces an empty line, otherwise goes below it. */
function $placeBlock(block: ElementNode) {
  const current = $currentBlock();
  if (!current) {
    $getRoot().append(block);
  } else if ($isParagraphNode(current) && current.getTextContentSize() === 0) {
    current.replace(block);
  } else {
    current.insertAfter(block);
  }
  // Always leave a line after it, so there's somewhere to keep writing.
  if (!block.getNextSibling()) block.insertAfter($createParagraphNode());
}

/** The outermost callout/toggle that ends the page, if the cursor sits at its very end (or start). */
function $edgeContainer(direction: 'down' | 'up'): ElementNode | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const node = selection.anchor.getNode();
  const top = node.getTopLevelElement();
  if (!isBlockContainer(top)) return null;
  const root = $getRoot();
  const down = direction === 'down';
  if ((down ? root.getLastChild() : root.getFirstChild()) !== top) return null;
  const edge = down ? top.getLastDescendant() : top.getFirstDescendant();
  if (!edge || !node.is(edge)) return null;
  const { offset, type } = selection.anchor;
  const end = type === 'text' ? node.getTextContentSize() : $isElementNode(node) ? node.getChildrenSize() : 0;
  return offset === (down ? end : 0) ? top : null;
}

export function BlocksPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      // Keep the caret where it is when clicking a block's icon.
      if (target?.closest('.editor-callout-icon, .editor-toggle-chevron')) event.preventDefault();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const chevron = target?.closest<HTMLElement>('.editor-toggle-chevron');
      const icon = target?.closest<HTMLElement>('.editor-callout-icon');
      if (!chevron && !icon) return;
      event.preventDefault();

      if (chevron) {
        const dom = chevron.closest<HTMLElement>('.editor-toggle');
        if (!dom) return;
        if (!editor.isEditable()) {
          // Read-only notes: open and close locally without changing the note.
          const open = dom.dataset.open === undefined;
          if (open) dom.dataset.open = '';
          else delete dom.dataset.open;
          chevron.setAttribute('aria-expanded', String(open));
          return;
        }
        editor.update(() => {
          const node = $getNearestNodeFromDOMNode(dom);
          if (!$isToggleContainerNode(node)) return;
          const open = !node.getOpen();
          node.setOpen(open);
          if (!open) {
            const selection = $getSelection();
            const content = node.getChildren().find($isToggleContentNode);
            if ($isRangeSelection(selection) && content?.isParentOf(selection.anchor.getNode())) {
              node.getFirstChild()?.selectEnd();
            }
          }
        });
        return;
      }

      if (icon && editor.isEditable()) {
        const dom = icon.closest<HTMLElement>('.editor-callout');
        if (!dom) return;
        editor.update(() => {
          const node = $getNearestNodeFromDOMNode(dom);
          if ($isCalloutNode(node)) node.setVariant(nextCalloutVariant(node.getVariant()));
        });
      }
    };

    return mergeRegister(
      editor.registerRootListener((root, prev) => {
        prev?.removeEventListener('mousedown', onMouseDown);
        prev?.removeEventListener('click', onClick);
        root?.addEventListener('mousedown', onMouseDown);
        root?.addEventListener('click', onClick);
      }),

      editor.registerCommand(
        INSERT_CALLOUT_COMMAND,
        (variant) => {
          const callout = $createCalloutWithParagraph(variant);
          $placeBlock(callout);
          callout.getFirstChild()?.selectStart();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),

      editor.registerCommand(
        INSERT_TOGGLE_COMMAND,
        () => {
          const { container, title } = $createToggle();
          $placeBlock(container);
          title.select();
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),

      // Enter on an empty last line inside a callout or toggle steps out below it.
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;
          const block = $currentBlock();
          if (!$isParagraphNode(block) || block.getTextContentSize() !== 0 || block.getNextSibling()) return false;
          const parent = block.getParent();
          const outer = $isCalloutNode(parent) ? parent : $isToggleContentNode(parent) ? parent.getParent() : null;
          if (!outer || !parent || parent.getChildrenSize() < 2) return false;
          outer.insertAfter(block);
          block.selectStart();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Ctrl/⌘ + Enter in a toggle's title opens or closes it.
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!event || !(event.ctrlKey || event.metaKey)) return false;
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return false;
          const title = $findMatchingParent(selection.anchor.getNode(), $isToggleTitleNode);
          const container = title?.getParent();
          if (!$isToggleContainerNode(container)) return false;
          event.preventDefault();
          container.setOpen(!container.getOpen());
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Arrow keys can always leave a callout/toggle that starts or ends the page.
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          const container = $edgeContainer('down');
          if (!container) return false;
          event?.preventDefault();
          const paragraph = $createParagraphNode();
          container.insertAfter(paragraph);
          paragraph.select();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          const container = $edgeContainer('up');
          if (!container) return false;
          event?.preventDefault();
          const paragraph = $createParagraphNode();
          container.insertBefore(paragraph);
          paragraph.select();
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),

      // Keep each block's shape valid after pastes, deletes and undo.
      editor.registerNodeTransform(CalloutNode, (node) => {
        if (node.getChildrenSize() === 0) node.append($createParagraphNode());
      }),
      editor.registerNodeTransform(ToggleContainerNode, (node) => {
        const children = node.getChildren();
        const title = children[0];
        if (!$isToggleTitleNode(title)) {
          // No title left: dissolve into plain blocks (a stray title becomes a paragraph below).
          for (const child of children) node.insertBefore(child);
          node.remove();
          return;
        }
        if (!children.some($isToggleContentNode)) {
          node.append($createToggleContentNode().append($createParagraphNode()));
        }
      }),
      editor.registerNodeTransform(ToggleTitleNode, (node) => {
        if (!$isToggleContainerNode(node.getParent())) {
          const paragraph = $createParagraphNode();
          paragraph.append(...node.getChildren());
          node.replace(paragraph);
        }
      }),
      editor.registerNodeTransform(ToggleContentNode, (node) => {
        if (!$isToggleContainerNode(node.getParent())) {
          for (const child of node.getChildren()) node.insertBefore(child);
          node.remove();
          return;
        }
        if (node.getChildrenSize() === 0) node.append($createParagraphNode());
      }),

      editor.registerMutationListener(ToggleContainerNode, (mutations) => {
        editor.getEditorState().read(() => {
          for (const [key, type] of mutations) {
            if (type === 'destroyed') continue;
            const dom = editor.getElementByKey(key);
            dom
              ?.querySelector(':scope > .editor-toggle-title > .editor-toggle-chevron')
              ?.setAttribute('aria-expanded', String(dom.dataset.open !== undefined));
          }
        });
      }, { skipInitialization: false }),
    );
  }, [editor]);

  return null;
}

export default BlocksPlugin;
