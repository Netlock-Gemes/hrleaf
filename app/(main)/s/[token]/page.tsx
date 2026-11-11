import { Globe } from "lucide-react";
import { Metadata } from "next";
import { notFound } from "next/navigation";

import EditorContainer from "@/app/components/editor/EditorContainer";
import SiteHeader from "@/app/components/SiteHeader";
import StaticNote, { formatDay } from "@/app/components/StaticNote";
import { renderDocumentStatic } from "@/lib/static-render";
import { getSharedDocument } from "@/server/document-service";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = await getSharedDocument((await params).token).catch(() => null);
  if (!doc) return { title: "Not found" };
  return {
    title: doc.slug,
    description: doc.share?.mode === "write" ? "A shared HRLeaf note you can edit." : "A shared HRLeaf note.",
    // Never let a share link leak through the Referer header.
    referrer: "no-referrer",
  };
}

/** A note opened through its public share link. No account needed. */
export default async function SharedNotePage({ params }: Props) {
  const { token } = await params;
  const doc = await getSharedDocument(token);
  if (!doc || !doc.share) notFound();

  if (doc.share.mode === "write") {
    return (
      <EditorContainer
        key={token}
        slug={doc.slug}
        shareToken={token}
        initialContent={doc.content ? JSON.stringify(doc.content) : null}
        isReadOnly={doc.read_only}
        updatedAt={doc.updated_at}
        previousUpdatedAt={null}
        preview={renderDocumentStatic(doc.content)}
        viewer={null}
      />
    );
  }

  const updated = formatDay(doc.updated_at);
  return (
    <div className="editor-main">
      <SiteHeader
        homeHref={`/s/${token}`}
        trail={<span className="block truncate font-mono text-[13px] text-[--text-secondary]">{doc.slug}</span>}
      >
        <span className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-[--text-tertiary]">
          <Globe className="h-3.5 w-3.5" aria-hidden />
          <span>
            Shared<span className="hidden sm:inline"> · read only{updated ? ` · updated ${updated}` : ""}</span>
          </span>
        </span>
      </SiteHeader>
      <StaticNote content={doc.content} />
    </div>
  );
}
