import {
  $applyNodeReplacement,
  $createParagraphNode,
  DOMExportOutput,
  ElementDOMSlot,
  ElementNode,
  LexicalNode,
  RangeSelection,
  SerializedElementNode,
  setDOMUnmanaged,
} from 'lexical';

import { COPY_BLOCK_BAR_HTML } from '@/lib/blocks';

export type SerializedCopyBlockNode = SerializedElementNode;

/**
 * A box of normal blocks (an email, a message, a template) with a Copy button
 * that copies everything inside with its formatting. The bar sits outside
 * Lexical's managed children; the click is handled by CopyBlockListener.
 */
export class CopyBlockNode extends ElementNode {
  static getType(): string {
    return 'copyblock';
  }

  static clone(node: CopyBlockNode): CopyBlockNode {
    return new CopyBlockNode(node.__key);
  }

  static importJSON(json: SerializedCopyBlockNode): CopyBlockNode {
    return $createCopyBlockNode().updateFromJSON(json);
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'editor-copyblock';

    const bar = document.createElement('div');
    bar.className = 'editor-copyblock-bar';
    bar.contentEditable = 'false';
    bar.innerHTML = COPY_BLOCK_BAR_HTML;
    setDOMUnmanaged(bar);

    const body = document.createElement('div');
    body.className = 'editor-copyblock-body';

    dom.append(bar, body);
    return dom;
  }

  updateDOM(): boolean {
    return false;
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    const body = element.querySelector<HTMLElement>(':scope > .editor-copyblock-body');
    return super.getDOMSlot(element).withElement(body ?? element);
  }

  exportDOM(): DOMExportOutput {
    return { element: document.createElement('div') };
  }

  isShadowRoot(): boolean {
    return true;
  }

  canBeEmpty(): boolean {
    return false;
  }

  canIndent(): boolean {
    return false;
  }

  /** Backspace at the very start turns it back into plain blocks. */
  collapseAtStart(_selection: RangeSelection): boolean {
    const children = this.getChildren();
    for (const child of children) this.insertBefore(child);
    this.remove();
    if (children[0]) children[0].selectStart();
    return true;
  }
}

export function $createCopyBlockNode(): CopyBlockNode {
  return $applyNodeReplacement(new CopyBlockNode());
}

export function $createCopyBlockWithParagraph(): CopyBlockNode {
  return $createCopyBlockNode().append($createParagraphNode());
}

export function $isCopyBlockNode(node: LexicalNode | null | undefined): node is CopyBlockNode {
  return node instanceof CopyBlockNode;
}
