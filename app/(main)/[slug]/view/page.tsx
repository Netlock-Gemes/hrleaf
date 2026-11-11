import "katex/dist/katex.css";

import { PenLine } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewNoteButton } from "@/app/components/NewNoteDialog";
import SiteHeader from "@/app/components/SiteHeader";
import { noteSummary } from "@/lib/site";
import { renderDocumentStatic } from "@/lib/static-render";
import { getEditorDocument, getNoteFacts } from "@/server/document-service";
import { normaliseSlug } from "@/server/document-utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = normaliseSlug(raw) ?? raw;
  const facts = await getNoteFacts(slug).catch(() => null);
  const description = facts
    ? `Read-only view of a private HRLeaf note. ${noteSummary({ ...facts, read_only: false }).join(" · ")}.`
    : "Read-only view of a private HRLeaf note.";
  return {
    title: `${slug} (read only)`,
    description,
    alternates: { canonical: `/${slug}/view` },
    openGraph: { type: "article", title: `/${slug}`, description, url: `/${slug}/view` },
    twitter: { card: "summary_large_image", title: `/${slug} (read only)`, description },
  };
}

/** Read-only, editor-free view of the last saved version. Ships almost no JavaScript. */
export default async function ViewPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = normaliseSlug(raw);
  if (!slug) notFound();

  const doc = await getEditorDocument(slug);
  const body = renderDocumentStatic(doc?.content, { equations: "katex" });

  const updated = doc?.updated_at
    ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(doc.updated_at))
    : null;

  return (
    <div className="editor-main">
      <SiteHeader
        trail={<span className="block truncate font-mono text-[13px] text-[--text-secondary]">{slug}</span>}
      >
        <span className="hidden text-[13px] text-[--text-tertiary] sm:inline">
          Read only{updated ? ` · updated ${updated}` : ""}
        </span>
        {doc?.read_only ? null : (
          <Link
            href={`/${slug}`}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <PenLine className="h-4 w-4" aria-hidden />
            Edit
          </Link>
        )}
        <NewNoteButton />
      </SiteHeader>
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
    </div>
  );
}
