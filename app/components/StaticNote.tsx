import "katex/dist/katex.css";

import { renderDocumentStatic } from "@/lib/static-render";

import NoteFields, { formatNoteDate } from "./NoteFields";

/** Editor-free, read-only rendering of a saved note. Ships almost no JavaScript. */
export default function StaticNote({
  content,
  name,
  access,
  updatedAt,
}: {
  content: object | null | undefined;
  name: string;
  access: string;
  updatedAt?: string | null;
}) {
  const body = renderDocumentStatic(content, { equations: "katex" });
  return (
    <main id="main" className="editor-root">
      <article className="editor-area cursor-auto">
        <NoteFields name={name} access={access} updatedAt={updatedAt} />
        <div className="editor-wrapper">
          {body ? (
            <div className="editor-input editor-static">{body}</div>
          ) : (
            <p className="text-[--text-tertiary]">This note is empty.</p>
          )}
        </div>
      </article>
    </main>
  );
}

export const formatDay = formatNoteDate;
