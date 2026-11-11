import {
  $applyNodeReplacement,
  $createParagraphNode,
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

import {
  CALLOUT_ICONS,
  CALLOUT_LABELS,
  CalloutVariant,
  isCalloutVariant,
} from '@/lib/blocks';

export type SerializedCalloutNode = Spread<{ variant: CalloutVariant }, SerializedElementNode>;

/**
 * A tinted box (note, tip, warning, important) holding normal blocks.
 * Its icon sits outside Lexical's managed children; clicking it cycles the type.
 */
export class CalloutNode extends ElementNode {
  __variant: CalloutVariant;

  static getType(): string {
    return 'callout';
  }

  static clone(node: CalloutNode): CalloutNode {
    return new CalloutNode(node.__variant, node.__key);
  }

  constructor(variant: CalloutVariant = 'note', key?: NodeKey) {
    super(key);
    this.__variant = variant;
  }

  static importJSON(json: SerializedCalloutNode): CalloutNode {
    return $createCalloutNode().updateFromJSON(json);
  }

  updateFromJSON(json: LexicalUpdateJSON<SerializedCalloutNode>): this {
    return super.updateFromJSON(json).setVariant(isCalloutVariant(json.variant) ? json.variant : 'note');
  }

  exportJSON(): SerializedCalloutNode {
    return { ...super.exportJSON(), variant: this.getVariant() };
  }

  getVariant(): CalloutVariant {
    return this.getLatest().__variant;
  }

  setVariant(variant: CalloutVariant): this {
    const self = this.getWritable();
    self.__variant = variant;
    return self;
  }

  createDOM(): HTMLElement {
    const dom = document.createElement('div');
    dom.className = 'editor-callout';
    dom.dataset.variant = this.__variant;

    const icon = document.createElement('button');
    icon.type = 'button';
    icon.className = 'editor-callout-icon';
    icon.contentEditable = 'false';
    icon.tabIndex = -1;
    setDOMUnmanaged(icon);
    setIcon(icon, this.__variant);

    const body = document.createElement('div');
    body.className = 'editor-callout-body';

    dom.append(icon, body);
    return dom;
  }

  updateDOM(prev: CalloutNode, dom: HTMLElement): boolean {
    if (prev.__variant !== this.__variant) {
      dom.dataset.variant = this.__variant;
      const icon = dom.querySelector<HTMLElement>(':scope > .editor-callout-icon');
      if (icon) setIcon(icon, this.__variant);
    }
    return false;
  }

  getDOMSlot(element: HTMLElement): ElementDOMSlot<HTMLElement> {
    const body = element.querySelector<HTMLElement>(':scope > .editor-callout-body');
    return super.getDOMSlot(element).withElement(body ?? element);
  }

  exportDOM(): DOMExportOutput {
    const el = document.createElement('aside');
    el.dataset.callout = this.getVariant();
    return { element: el };
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

  /** Backspace at the very start turns the callout back into plain blocks. */
  collapseAtStart(_selection: RangeSelection): boolean {
    const children = this.getChildren();
    for (const child of children) this.insertBefore(child);
    this.remove();
    if (children[0]) children[0].selectStart();
    return true;
  }
}

function setIcon(icon: HTMLElement, variant: CalloutVariant) {
  icon.innerHTML = CALLOUT_ICONS[variant];
  icon.title = `${CALLOUT_LABELS[variant]}. Click to change`;
  icon.setAttribute('aria-label', `${CALLOUT_LABELS[variant]} callout. Change type`);
}

export function $createCalloutNode(variant: CalloutVariant = 'note'): CalloutNode {
  return $applyNodeReplacement(new CalloutNode(variant));
}

export function $createCalloutWithParagraph(variant: CalloutVariant = 'note'): CalloutNode {
  return $createCalloutNode(variant).append($createParagraphNode());
}

export function $isCalloutNode(node: LexicalNode | null | undefined): node is CalloutNode {
  return node instanceof CalloutNode;
}
