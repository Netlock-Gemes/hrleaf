import { ElementTransformer } from '@lexical/markdown';
import { $isElementNode, ElementNode, LexicalNode } from 'lexical';

import { CALLOUT_LABELS } from '@/lib/blocks';

import {
  $isCalloutNode,
  $isToggleContainerNode,
  $isToggleContentNode,
  $isToggleTitleNode,
  CalloutNode,
  ToggleContainerNode,
  ToggleContentNode,
  ToggleTitleNode,
} from '../custom-nodes';

/** Export-only: these blocks have no markdown shortcut, so the pattern never matches. */
const NEVER = /(?!)/;

const blockLines = (node: ElementNode, traverse: (n: ElementNode) => string) =>
  node.getChildren().map((child) => ($isElementNode(child) ? traverse(child) : child.getTextContent()));

/** GitHub-style alert: `> [!NOTE]` followed by quoted lines. */
export const CALLOUT: ElementTransformer = {
  dependencies: [CalloutNode],
  export: (node: LexicalNode, traverse) => {
    if (!$isCalloutNode(node)) return null;
    const label = CALLOUT_LABELS[node.getVariant()].toUpperCase();
    const lines = blockLines(node, traverse).join('\n>\n').split('\n').map((l) => (l === '>' ? l : `> ${l}`));
    return [`> [!${label}]`, ...lines].join('\n');
  },
  regExp: NEVER,
  replace: () => false,
  type: 'element',
};

/** HTML `<details>`, which most markdown viewers render as a collapsible section. */
export const TOGGLE: ElementTransformer = {
  dependencies: [ToggleContainerNode, ToggleTitleNode, ToggleContentNode],
  export: (node: LexicalNode, traverse) => {
    if (!$isToggleContainerNode(node)) return null;
    const title = node.getChildren().find($isToggleTitleNode);
    const content = node.getChildren().find($isToggleContentNode);
    const body = content ? blockLines(content, traverse).join('\n\n') : '';
    return `<details${node.getOpen() ? ' open' : ''}>\n<summary>${title ? traverse(title) : ''}</summary>\n\n${body}\n\n</details>`;
  },
  regExp: NEVER,
  replace: () => false,
  type: 'element',
};
