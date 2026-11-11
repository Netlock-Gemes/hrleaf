'use client';


import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { EditorRefPlugin } from '@lexical/react/LexicalEditorRefPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { EditorState, LexicalEditor } from 'lexical';
import { MutableRefObject, ReactElement, ReactNode, useEffect, useState } from 'react';

import {
  CalloutNode,
  EquationNode,
  InlineTableInputNode,
  ToggleContainerNode,
  ToggleContentNode,
  ToggleTitleNode,
} from './custom-nodes';
import {
  BlockRailPlugin,
  BlocksPlugin,
  CodeHighlightPlugin,
  ComponentPickerPlugin,
  EquationPlugin,
  FloatingFormatToolbarPlugin,
  LinksPlugin,
  NoteLinkPlugin,
  TablePlugin,
} from './custom-plugins';
import { HRLEAF_TRANSFORMERS } from './custom-transformers/HRLeafTransformers';
import DefaultTheme from './themes/DefaultTheme';

interface EditorProps {
  initialContent: string | null;
  editable?: boolean;
  onEditorStateChange: (editorState: EditorState) => void;
  editorRef?: MutableRefObject<LexicalEditor | null>;
  /** Server-rendered copy of the content, shown until the editor has mounted. */
  preview?: ReactNode;
  /** Ruled header fields across the top of the sheet. */
  header?: ReactNode;
  /** Hide the left block toolbar (focus mode while typing). */
  railHidden?: boolean;
}

const theme = DefaultTheme;

function onError(error: Error) {
  console.error(error);
}

export default function Editor({
  initialContent,
  editable = true,
  onEditorStateChange,
  editorRef,
  preview,
  header,
  railHidden = false,
}: EditorProps): ReactElement {
  // Instant first paint: show static HTML until Lexical has rendered the real thing.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showPreview = !mounted && !!preview;

  // Create a ref for the floating anchor element
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);

  // Function to set the floating anchor ref
  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  const editorConfig = {
    namespace: 'hrleaf-editor',
    theme,
    onError,
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode,
      InlineTableInputNode,
      HorizontalRuleNode,
      EquationNode,
      CalloutNode,
      ToggleContainerNode,
      ToggleTitleNode,
      ToggleContentNode,
    ],
    editorState: initialContent,
    editable,
  };

  return (
    <div className="editor-root">
      <LexicalComposer initialConfig={editorConfig}>
        <div className="editor-area">
          {header}
          <RichTextPlugin
            contentEditable={
              <div ref={onRef} className="editor-wrapper">
                {showPreview ? (
                  <div className="editor-input editor-static" aria-hidden>
                    {preview}
                  </div>
                ) : null}
                <ContentEditable
                  className={`editor-input${showPreview ? ' hidden' : ''}`}
                  aria-label="Document text"
                  role="textbox"
                  suppressHydrationWarning
                />
              </div>
            }
            placeholder={
              showPreview ? null : <div className="editor-placeholder">
                {editable ? 'Start writing. Type / for blocks, or use markdown.' : 'This document is empty.'}
              </div>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <EditablePlugin editable={editable} />
          {editorRef ? <EditorRefPlugin editorRef={editorRef} /> : null}
          <FloatingFormatToolbarPlugin />
          <HistoryPlugin />
          {!initialContent && editable && <AutoFocusPlugin />}
          <ListPlugin />
          <ComponentPickerPlugin />
          <CheckListPlugin />
          <CodeHighlightPlugin />
          <TabIndentationPlugin maxIndent={7} />
          <MarkdownShortcutPlugin transformers={HRLEAF_TRANSFORMERS} />
          <HorizontalRulePlugin />
          <OnChangePlugin
            onChange={onEditorStateChange}
            ignoreSelectionChange={true}
          />
          <LinksPlugin/>
          <TablePlugin anchorElem={floatingAnchorElem} />
          <EquationPlugin />
          <BlocksPlugin />
          <BlockRailPlugin hidden={railHidden} />
          {editable ? <NoteLinkPlugin /> : null}
        </div>
      </LexicalComposer>
    </div>
  );
}

/** Keeps Lexical's editable flag in sync when a document gets locked mid-session. */
function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
}
