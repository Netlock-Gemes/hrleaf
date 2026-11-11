import { $createCodeNode } from '@lexical/code';
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { $getNearestBlockElementAncestorOrThrow } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  ElementFormatType,
  FORMAT_ELEMENT_COMMAND,
  INDENT_CONTENT_COMMAND,
  LexicalEditor,
  OUTDENT_CONTENT_COMMAND,
  TextNode,
} from 'lexical';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  CalendarDays,
  Clock,
  Code,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  IndentDecrease,
  IndentIncrease,
  Info,
  Lightbulb,
  List,
  ListChecks,
  ListCollapse,
  ListOrdered,
  LucideIcon,
  OctagonAlert,
  Pilcrow,
  Quote,
  RemoveFormatting,
  SeparatorHorizontal,
  Sigma,
  SquareSigma,
  Table,
  TriangleAlert,
} from 'lucide-react';
import { Fragment, ReactElement, useCallback, useMemo, useState } from 'react';
import * as ReactDOM from 'react-dom';

import { CalloutVariant } from '@/lib/blocks';

import { $createInlineTableInputNode } from '../custom-nodes';

import { INSERT_CALLOUT_COMMAND, INSERT_TOGGLE_COMMAND } from './BlocksPlugin';
import { INSERT_EQUATION_COMMAND } from './EquationPlugin';

type Group = 'Basic' | 'Lists' | 'Insert' | 'Code' | 'Math' | 'Format';
const GROUP_ORDER: Group[] = ['Basic', 'Lists', 'Insert', 'Code', 'Math', 'Format'];

class ComponentPickerOption extends MenuOption {
  title: string;
  group: Group;
  Icon: LucideIcon;
  keywords: string[];
  shortcut?: string;
  /** Only listed once the person starts typing (keeps the bare "/" menu short). */
  searchOnly: boolean;
  onSelect: (queryString: string) => void;

  constructor(
    title: string,
    options: {
      group: Group;
      icon: LucideIcon;
      keywords?: string[];
      shortcut?: string;
      searchOnly?: boolean;
      onSelect: (queryString: string) => void;
    },
  ) {
    super(title);
    this.title = title;
    this.group = options.group;
    this.Icon = options.icon;
    this.keywords = options.keywords ?? [];
    this.shortcut = options.shortcut;
    this.searchOnly = options.searchOnly ?? false;
    this.onSelect = options.onSelect.bind(this);
  }
}

function ComponentPickerMenuItem({
  index,
  isSelected,
  onClick,
  onMouseEnter,
  option,
}: {
  index: number;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  option: ComponentPickerOption;
}) {
  /*
    Force scroll selected item into view when it's outside the visible area.
    Lexical's own menu scrolling doesn't work on the first render after "/".
  */
  if (isSelected && option.ref?.current) {
    const element = option.ref.current;
    const parent = element.closest('.typeahead-popover ul');
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      if (elementRect.top < parentRect.top || elementRect.bottom > parentRect.bottom) {
        element.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  const { Icon } = option;
  return (
    <li
      tabIndex={-1}
      className={`item${isSelected ? ' selected' : ''}`}
      ref={option.setRefElement}
      role="option"
      aria-selected={isSelected}
      id={'typeahead-item-' + index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <Icon className="icon" size={16} strokeWidth={1.75} aria-hidden />
      <span className="text">{option.title}</span>
      {option.shortcut && <span className="shortcut">{option.shortcut}</span>}
    </li>
  );
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function setBlock(editor: LexicalEditor, create: () => ReturnType<typeof $createParagraphNode> | ReturnType<typeof $createHeadingNode> | ReturnType<typeof $createQuoteNode>) {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) $setBlocksType(selection, create);
  });
}

export function insertCode(editor: LexicalEditor, language?: string) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    if (selection.isCollapsed()) {
      $setBlocksType(selection, () => $createCodeNode(language));
    } else {
      const textContent = selection.getTextContent();
      const codeNode = $createCodeNode(language);
      selection.insertNodes([codeNode]);
      selection.insertRawText(textContent);
    }
  });
}

/** Removes bold, italic, colours and alignment from the selection, or the whole line when nothing is selected. */
function clearFormatting(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const nodes = selection.isCollapsed()
      ? $getNearestBlockElementAncestorOrThrow(selection.anchor.getNode()).getAllTextNodes()
      : selection.extract().filter($isTextNode);
    const blocks = new Set<string>();
    for (const node of nodes) {
      node.setFormat(0);
      node.setStyle('');
      const block = $getNearestBlockElementAncestorOrThrow(node);
      if (!blocks.has(block.getKey())) {
        blocks.add(block.getKey());
        block.setFormat('');
      }
    }
    selection.format = 0;
    selection.setStyle('');
  });
}

export function insertText(editor: LexicalEditor, text: string) {
  editor.update(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) selection.insertText(text);
  });
}

const CODE_LANGUAGES: { id: string; name: string; keywords: string[] }[] = [
  { id: 'js', name: 'JavaScript', keywords: ['javascript', 'js', 'node'] },
  { id: 'typescript', name: 'TypeScript', keywords: ['typescript', 'ts'] },
  { id: 'py', name: 'Python', keywords: ['python', 'py'] },
  { id: 'sql', name: 'SQL', keywords: ['sql', 'query', 'database'] },
  { id: 'html', name: 'HTML', keywords: ['html', 'markup'] },
  { id: 'css', name: 'CSS', keywords: ['css', 'styles'] },
  { id: 'java', name: 'Java', keywords: ['java'] },
  { id: 'cpp', name: 'C++', keywords: ['cpp', 'c++'] },
  { id: 'c', name: 'C', keywords: ['c language'] },
  { id: 'rust', name: 'Rust', keywords: ['rust', 'rs'] },
  { id: 'swift', name: 'Swift', keywords: ['swift'] },
  { id: 'powershell', name: 'PowerShell', keywords: ['powershell', 'ps', 'shell'] },
  { id: 'markdown', name: 'Markdown', keywords: ['markdown', 'md'] },
];

const CALLOUTS: { variant: CalloutVariant; title: string; icon: LucideIcon; keywords: string[] }[] = [
  { variant: 'note', title: 'Callout', icon: Info, keywords: ['callout', 'note', 'info', 'box', 'admonition'] },
  { variant: 'tip', title: 'Callout: Tip', icon: Lightbulb, keywords: ['callout', 'tip', 'hint', 'idea'] },
  { variant: 'warning', title: 'Callout: Warning', icon: TriangleAlert, keywords: ['callout', 'warning', 'caution'] },
  { variant: 'danger', title: 'Callout: Important', icon: OctagonAlert, keywords: ['callout', 'important', 'danger', 'alert'] },
];

function getDynamicOptions(editor: LexicalEditor, queryString: string) {
  const tableMatch = queryString.match(/^([1-9]\d?)(?:x([1-9]\d?)?)?$/);
  if (tableMatch === null) return [];

  const rows = tableMatch[1];
  const colOptions = tableMatch[2] ? [tableMatch[2]] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(String);
  return colOptions.map(
    (columns) =>
      new ComponentPickerOption(`${rows}×${columns} Table`, {
        group: 'Insert',
        icon: Table,
        keywords: ['table'],
        onSelect: () => editor.dispatchCommand(INSERT_TABLE_COMMAND, { columns, rows }),
      }),
  );
}

function getBaseOptions(editor: LexicalEditor): ComponentPickerOption[] {
  const headingIcons = [Heading1, Heading2, Heading3, Heading4];
  const alignIcons: Record<string, LucideIcon> = {
    left: AlignLeft,
    center: AlignCenter,
    right: AlignRight,
    justify: AlignJustify,
  };

  return [
    // Basic
    new ComponentPickerOption('Paragraph', {
      group: 'Basic',
      icon: Pilcrow,
      keywords: ['normal', 'paragraph', 'p', 'text'],
      onSelect: () => setBlock(editor, () => $createParagraphNode()),
    }),
    ...([1, 2, 3, 4] as const).map(
      (n) =>
        new ComponentPickerOption(`Heading ${n}`, {
          group: 'Basic',
          icon: headingIcons[n - 1],
          keywords: ['heading', 'header', 'title', `h${n}`],
          shortcut: '#'.repeat(n),
          onSelect: () => setBlock(editor, () => $createHeadingNode(`h${n}`)),
        }),
    ),
    new ComponentPickerOption('Quote', {
      group: 'Basic',
      icon: Quote,
      keywords: ['block quote', 'blockquote', 'citation'],
      shortcut: '>',
      onSelect: () => setBlock(editor, () => $createQuoteNode()),
    }),
    ...CALLOUTS.map(
      ({ variant, title, icon, keywords }) =>
        new ComponentPickerOption(title, {
          group: 'Basic',
          icon,
          keywords,
          searchOnly: variant !== 'note',
          onSelect: () => editor.dispatchCommand(INSERT_CALLOUT_COMMAND, variant),
        }),
    ),
    new ComponentPickerOption('Toggle', {
      group: 'Basic',
      icon: ListCollapse,
      keywords: ['toggle', 'collapsible', 'collapse', 'expand', 'details', 'accordion', 'fold', 'spoiler'],
      onSelect: () => editor.dispatchCommand(INSERT_TOGGLE_COMMAND, undefined),
    }),
    new ComponentPickerOption('Divider', {
      group: 'Basic',
      icon: SeparatorHorizontal,
      keywords: ['horizontal rule', 'divider', 'hr', 'line', 'separator'],
      shortcut: '---',
      onSelect: () => editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined),
    }),

    // Lists
    new ComponentPickerOption('Bulleted list', {
      group: 'Lists',
      icon: List,
      keywords: ['bulleted list', 'unordered list', 'ul', 'bullet'],
      shortcut: '-',
      onSelect: () => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined),
    }),
    new ComponentPickerOption('Numbered list', {
      group: 'Lists',
      icon: ListOrdered,
      keywords: ['numbered list', 'ordered list', 'ol'],
      shortcut: '1.',
      onSelect: () => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined),
    }),
    new ComponentPickerOption('Checklist', {
      group: 'Lists',
      icon: ListChecks,
      keywords: ['check list', 'checklist', 'todo list', 'task'],
      shortcut: '[ ]',
      onSelect: () => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined),
    }),

    // Insert
    new ComponentPickerOption('Table', {
      group: 'Insert',
      icon: Table,
      keywords: ['table', 'grid', 'spreadsheet', 'rows', 'columns'],
      shortcut: '/3x4',
      onSelect: () =>
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) selection.insertNodes([$createInlineTableInputNode()]);
        }),
    }),
    new ComponentPickerOption('Link to note', {
      group: 'Insert',
      icon: FileText,
      keywords: ['link', 'note', 'page', 'reference', 'wiki', 'mention'],
      shortcut: '[[',
      onSelect: () => insertText(editor, '[['),
    }),
    new ComponentPickerOption("Today's date", {
      group: 'Insert',
      icon: CalendarDays,
      keywords: ['date', 'today', 'day'],
      onSelect: () =>
        insertText(
          editor,
          new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date()),
        ),
    }),
    new ComponentPickerOption('Current time', {
      group: 'Insert',
      icon: Clock,
      keywords: ['time', 'now', 'clock'],
      onSelect: () =>
        insertText(editor, new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date())),
    }),

    // Code
    new ComponentPickerOption('Code block', {
      group: 'Code',
      icon: Code,
      keywords: ['code', 'codeblock', 'snippet', 'pre'],
      shortcut: '```',
      onSelect: () => insertCode(editor),
    }),
    ...CODE_LANGUAGES.map(
      (lang) =>
        new ComponentPickerOption(`Code: ${lang.name}`, {
          group: 'Code',
          icon: Code,
          keywords: ['code', ...lang.keywords],
          searchOnly: true,
          onSelect: () => insertCode(editor, lang.id),
        }),
    ),

    // Math
    new ComponentPickerOption('Inline equation', {
      group: 'Math',
      icon: Sigma,
      keywords: ['equation', 'inline', 'math', 'formula', 'latex', '$'],
      shortcut: '$x$',
      onSelect: () =>
        editor.dispatchCommand(INSERT_EQUATION_COMMAND, { equation: '', inline: true, startInEditMode: true }),
    }),
    new ComponentPickerOption('Block equation', {
      group: 'Math',
      icon: SquareSigma,
      keywords: ['equation', 'block', 'display', 'math', 'formula', 'latex', '$$', 'centered'],
      shortcut: '$$',
      onSelect: () =>
        editor.dispatchCommand(INSERT_EQUATION_COMMAND, { equation: '', inline: false, startInEditMode: true }),
    }),

    // Format
    new ComponentPickerOption('Indent', {
      group: 'Format',
      icon: IndentIncrease,
      keywords: ['indent', 'tab', 'nest'],
      shortcut: 'Tab',
      onSelect: () => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined),
    }),
    new ComponentPickerOption('Outdent', {
      group: 'Format',
      icon: IndentDecrease,
      keywords: ['outdent', 'unindent', 'dedent'],
      shortcut: '⇧Tab',
      onSelect: () => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined),
    }),
    new ComponentPickerOption('Clear formatting', {
      group: 'Format',
      icon: RemoveFormatting,
      keywords: ['clear', 'remove', 'formatting', 'plain', 'reset'],
      onSelect: () => clearFormatting(editor),
    }),
    ...(['left', 'center', 'right', 'justify'] as const).map(
      (alignment) =>
        new ComponentPickerOption(`Align ${alignment}`, {
          group: 'Format',
          icon: alignIcons[alignment],
          keywords: ['align', 'justify', alignment],
          onSelect: () => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment as ElementFormatType),
        }),
    ),
  ];
}

export function ComponentPickerPlugin(): ReactElement {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', { minLength: 0 });

  const baseOptions = useMemo(() => getBaseOptions(editor), [editor]);

  const options = useMemo(() => {
    if (!queryString) return baseOptions.filter((o) => !o.searchOnly);

    const regex = new RegExp(escapeRegExp(queryString), 'i');
    const startsWith = new RegExp('^' + escapeRegExp(queryString), 'i');
    const matches = baseOptions.filter(
      (o) => regex.test(o.title) || o.keywords.some((k) => regex.test(k)),
    );
    // Keep the menu's sections, but put the best match first within each one.
    const rank = (o: ComponentPickerOption) =>
      startsWith.test(o.title) ? 0 : o.keywords.some((k) => startsWith.test(k)) ? 1 : 2;
    const sorted = GROUP_ORDER.flatMap((g) =>
      matches.filter((o) => o.group === g).sort((a, b) => rank(a) - rank(b)),
    );
    return [...getDynamicOptions(editor, queryString), ...sorted];
  }, [editor, baseOptions, queryString]);

  const onSelectOption = useCallback(
    (
      selectedOption: ComponentPickerOption,
      nodeToRemove: TextNode | null,
      closeMenu: () => void,
      matchingString: string,
    ) => {
      editor.update(() => {
        nodeToRemove?.remove();
        selectedOption.onSelect(matchingString);
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<ComponentPickerOption>
      onQueryChange={setQueryString}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(anchorElementRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchorElementRef.current && options.length
          ? ReactDOM.createPortal(
            <div className="typeahead-popover component-picker-menu">
              <ul role="listbox" aria-label="Insert block">
                {options.map((option, i) => (
                  <Fragment key={option.key}>
                    {i === 0 || options[i - 1].group !== option.group ? (
                      <li role="presentation" className="picker-section">
                        {option.group}
                      </li>
                    ) : null}
                    <ComponentPickerMenuItem
                      index={i}
                      isSelected={selectedIndex === i}
                      onClick={() => {
                        setHighlightedIndex(i);
                        selectOptionAndCleanUp(option);
                      }}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      option={option}
                    />
                  </Fragment>
                ))}
              </ul>
            </div>,
            anchorElementRef.current,
          )
          : null
      }
    />
  );
}
