import "katex/dist/katex.css";

import { renderDocumentStatic } from "@/lib/static-render";

/** Editor-free, read-only rendering of a saved note. Ships almost no JavaScript. */
export default function StaticNote({ content }: { content: object | null | undefined }) {
  const body = renderDocumentStatic(content, { equations: "katex" });
  return (
    <div className="editor-root">
      <article className="editor-area cursor-auto">
        <div className="editor-wrapper">
          {body ? (
            <div className="editor-input editor-static">{body}</div>
          ) : (
            <p className="text-[--text-tertiary]">This note is empty.</p>
          )}
        </div>
      </article>
    </div>
  );
}

export function formatDay(iso: string | null | undefined) {
  return iso
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))
    : null;
}
