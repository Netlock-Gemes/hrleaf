import {
  $applyNodeReplacement,
  $createParagraphNode,
  $isElementNode,
  DOMExportOutput,
  ElementDOMSlot,
  ElementNode,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
  RangeSelection,
  SerializedElementNode,
  setDOMUnmanaged,
  Spread,
} from 'lexical';

import { CHEVRON_ICON } from '@/lib/blocks';

/*
 * A collapsible section:
 *   ToggleContainerNode (open/closed)
 *     ├─ ToggleTitleNode   (one line of text, with the chevron)
 *     └─ ToggleContentNode (any blocks, hidden when closed)
 * TogglePlugin keeps this shape intact and handles the keyboard.
 */

export type SerializedToggleContainerNode = Spread<{ open: boolean }, SerializedElementNode>;

export class ToggleContainerNode extends ElementNode {
  __open: boolean;

  static getType(): string {
    return 'toggle';
  }

  static clone(node: ToggleContainerNode): ToggleContainerNode {
    return new ToggleContainerNode(node.__open, node.__key);
  }

  constructor(open = true, key?: NodeKey) {
    super(key);
    this.__open = open;
  }

  static importJSON(json: SerializedToggleContainerNode): ToggleContainerNode {
    return $createToggleContainerNode().updateFromJSON(json);
  }

  updateFromJSON(json: LexicalUpdateJSON<SerializedToggleContainerNode>): this {
    return super.updateFromJSON(json).setOpen(json.open !== false);
  }

  exportJSON(): SerializedToggleContainerNode {
    return { ...super.exportJSON(), open: this.getOpen() };
  }

  getOpen(): boolean {
    return this.getLatest().__open;
  }

  setOpen(open: boolean): this {
    const self = this.getWritable();
    self.__open = open;
    return self;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'editor-toggle';
    setOpenAttr(dom, this.__open);
    return dom;
  }

  updateDOM(prev: ToggleContainerNode, dom: HTMLElement): boolean {
    if (prev.__open !== this.__open) setOpenAttr(dom, this.__open);
    return false;
  }

  exportDOM(): DOMExportOutput {
    const el = document.createElement('details');
    if (this.getOpen()) el.setAttribute('open', '');
    return { element: el };
  }

  isShadowRoot(): boolean {
    return true;
  }

  canIndent(): boolean {
    return false;
  }
}

function setOpenAttr(dom: HTMLElement, open: boolean) {
  if (open) dom.dataset.open = '';
  else delete dom.dataset.open;
  dom.querySelector(':scope > .editor-toggle-title > .editor-toggle-chevron')?.setAttribute('aria-expanded', String(open));
}

export class ToggleTitleNode extends ElementNode {
  static getType(): string {
    return 'toggle-title';
  }

  static clone(node: ToggleTitleNode): ToggleTitleNode {
    return new ToggleTitleNode(node.__key);
  }

  static importJSON(json: SerializedElementNode): ToggleTitleNode {
    return $createToggleTitleNode().updateFromJSON(json);
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'editor-toggle-title';

    const chevron = document.createElement('button');
    chevron.type = 'button';
    chevron.className = 'editor-toggle-chevron';
    chevron.contentEditable = 'false';
    chevron.tabIndex = -1;
    chevron.setAttribute('aria-label', 'Show or hide section');
    chevron.innerHTML = CHEVRON_ICON;
    setDOMUnmanaged(chevron);

    const text = document.createElement('div');
    text.className = 'editor-toggle-title-text';

    dom.append(chevron, text);
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    const text = element.querySelector<HTMLElement>(':scope > .editor-toggle-title-text');
    return super.getDOMSlot(element).withElement(text ?? element);
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('summary') };
  }

  /** Enter in the title: go into the section when open, otherwise start a new line below it. */
  insertNewAfter(_selection: RangeSelection, restoreSelection = true): ElementNode {
    const container = this.getParent();
    if ($isToggleContainerNode(container) && container.getOpen()) {
      const content = this.getNextSibling();
      if ($isToggleContentNode(content)) {
        const first = content.getFirstChild();
        if ($isElementNode(first)) return first;
        const paragraph = $createParagraphNode();
        content.append(paragraph);
        return paragraph;
      }
    }
    const paragraph = $createParagraphNode();
    (container ?? this).insertAfter(paragraph, restoreSelection);
    return paragraph;
  }

  /** Backspace at the start of the title turns the whole toggle back into plain blocks. */
  collapseAtStart(): boolean {
    const container = this.getParent();
    if (!$isToggleContainerNode(container)) return false;
    const paragraph = $createParagraphNode();
    paragraph.append(...this.getChildren());
    container.insertBefore(paragraph);
    const content = container.getChildren().find($isToggleContentNode);
    for (const block of content?.getChildren() ?? []) container.insertBefore(block);
    container.remove();
    paragraph.selectStart();
    return true;
  }
}

export class ToggleContentNode extends ElementNode {
  static getType(): string {
    return 'toggle-content';
  }

  static clone(node: ToggleContentNode): ToggleContentNode {
    return new ToggleContentNode(node.__key);
  }

  static importJSON(json: SerializedElementNode): ToggleContentNode {
    return $createToggleContentNode().updateFromJSON(json);
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'editor-toggle-content';
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('div') };
  }

  isShadowRoot(): boolean {
    return true;
  }

  /** Backspace at the start of the section jumps to the end of the title. */
  collapseAtStart(): boolean {
    const title = this.getPreviousSibling();
    if ($isToggleTitleNode(title)) {
      title.selectEnd();
      return true;
    }
    return false;
  }
}

export function $createToggleContainerNode(open = true): ToggleContainerNode {
  return $applyNodeReplacement(new ToggleContainerNode(open));
}

export function $createToggleTitleNode(): ToggleTitleNode {
  return $applyNodeReplacement(new ToggleTitleNode());
}

export function $createToggleContentNode(): ToggleContentNode {
  return $applyNodeReplacement(new ToggleContentNode());
}

/** A ready-to-type toggle: empty title plus one empty paragraph inside. */
export function $createToggle(): { container: ToggleContainerNode; title: ToggleTitleNode } {
  const title = $createToggleTitleNode();
  const container = $createToggleContainerNode(true).append(
    title,
    $createToggleContentNode().append($createParagraphNode()),
  );
  return { container, title };
}

export function $isToggleContainerNode(node: LexicalNode | null | undefined): node is ToggleContainerNode {
  return node instanceof ToggleContainerNode;
}

export function $isToggleTitleNode(node: LexicalNode | null | undefined): node is ToggleTitleNode {
  return node instanceof ToggleTitleNode;
}

export function $isToggleContentNode(node: LexicalNode | null | undefined): node is ToggleContentNode {
  return node instanceof ToggleContentNode;
}
