import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { noteSummary } from "@/lib/site";
import { renderDocumentStatic } from "@/lib/static-render";
import { getEditorDocument, getNoteFacts } from "@/server/document-service";
import { normaliseSlug } from "@/server/document-utils";

import EditorContainer from "../../components/editor/EditorContainer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = normaliseSlug(raw) ?? raw;
  const facts = await getNoteFacts(slug).catch(() => null);
  const description = facts
    ? `A private HRLeaf note. ${noteSummary(facts).join(" · ")}.`
    : "A private HRLeaf note.";
  return {
    title: slug,
    description,
    alternates: { canonical: `/${slug}` },
    openGraph: { type: "article", title: `/${slug}`, description, url: `/${slug}` },
    twitter: { card: "summary_large_image", title: `/${slug}`, description },
  };
}

export default async function EditorPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = normaliseSlug(raw);
  if (!slug) notFound();
  if (slug !== raw) redirect(`/${slug}`);

  const doc = await getEditorDocument(slug);

  return (
    <EditorContainer
      // Remount when navigating between documents so editor state never leaks across.
      key={slug}
      slug={slug}
      initialContent={doc?.content ? JSON.stringify(doc.content) : null}
      isReadOnly={doc?.read_only ?? false}
      updatedAt={doc?.updated_at ?? null}
      previousUpdatedAt={doc?.previous_updated_at ?? null}
      preview={renderDocumentStatic(doc?.content)}
    />
  );
}
