'use client';

import { $createLinkNode } from '@lexical/link';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  MenuTextMatch,
} from '@lexical/react/LexicalTypeaheadMenuPlugin';
import { $createTextNode, TextNode } from 'lexical';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as ReactDOM from 'react-dom';

import { listNoteNames } from '@/server/document-actions';

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_RESULTS = 8;

/** `[[` followed by up to 64 characters of a note name, right before the cursor. */
function matchNoteLink(text: string): MenuTextMatch | null {
  const match = /\[\[([^\]\n[]{0,64})$/.exec(text);
  if (!match) return null;
  return {
    leadOffset: match.index,
    matchingString: match[1],
    replaceableString: match[0],
  };
}

class NoteOption extends MenuOption {
  slug: string;
  isNew: boolean;
  constructor(slug: string, isNew = false) {
    super(isNew ? `new:${slug}` : slug);
    this.slug = slug;
    this.isNew = isNew;
  }
}

/**
 * Type `[[` (or pick "Link to note" in the / menu) to link another note.
 * Lists only notes the signed-in person can open; share-link visitors get none.
 */
export function NoteLinkPlugin(): React.ReactElement | null {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[] | null>(null);

  // Load the list the first time the picker opens.
  useEffect(() => {
    if (query === null || notes !== null) return;
    let cancelled = false;
    listNoteNames()
      .then((list) => !cancelled && setNotes(list.map((n) => n.slug)))
      .catch(() => !cancelled && setNotes([]));
    return () => {
      cancelled = true;
    };
  }, [query, notes]);

  const options = useMemo(() => {
    if (query === null) return [];
    const q = query.trim().toLowerCase();
    const all = notes ?? [];
    const starts = all.filter((s) => s.startsWith(q));
    const contains = q ? all.filter((s) => !s.startsWith(q) && s.includes(q)) : [];
    const found = [...starts, ...contains].slice(0, MAX_RESULTS).map((s) => new NoteOption(s));
    const asSlug = q.replace(/\s+/g, '-');
    if (q && SLUG.test(asSlug) && !all.includes(asSlug)) found.push(new NoteOption(asSlug, true));
    return found;
  }, [query, notes]);

  const onSelectOption = useCallback(
    (option: NoteOption, nodeToReplace: TextNode | null, closeMenu: () => void) => {
      editor.update(() => {
        const link = $createLinkNode(`/${option.slug}`);
        const text = $createTextNode(option.slug);
        link.append(text);
        if (nodeToReplace) nodeToReplace.replace(link);
        // Continue typing after the link, not inside it.
        const after = $createTextNode(' ');
        link.insertAfter(after);
        after.select(1, 1);
        closeMenu();
      });
    },
    [editor],
  );

  return (
    <LexicalTypeaheadMenuPlugin<NoteOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={matchNoteLink}
      options={options}
      menuRenderFn={(anchorRef, { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex }) =>
        anchorRef.current
          ? ReactDOM.createPortal(
            <div className="typeahead-popover component-picker-menu note-link-menu">
              <p className="picker-section">{notes === null ? 'Loading notes…' : 'Link to note'}</p>
              {options.length ? (
                <ul role="listbox" aria-label="Notes">
                  {options.map((option, i) => (
                    <li
                      key={option.key}
                      ref={option.setRefElement}
                      role="option"
                      aria-selected={selectedIndex === i}
                      tabIndex={-1}
                      className={`item ${selectedIndex === i ? 'selected' : ''}`}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      onClick={() => {
                        setHighlightedIndex(i);
                        selectOptionAndCleanUp(option);
                      }}
                    >
                      <span className="text truncate">
                        {option.isNew ? (
                          <>
                            <span className="text-[--text-tertiary]">New note&nbsp;</span>
                            {option.slug}
                          </>
                        ) : (
                          option.slug
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : notes !== null ? (
                <p className="picker-empty">No matching notes. Names use a–z, 0–9 and dashes.</p>
              ) : null}
            </div>,
            anchorRef.current,
          )
          : null
      }
    />
  );
}

export default NoteLinkPlugin;
