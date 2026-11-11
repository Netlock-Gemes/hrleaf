import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { renderDocumentStatic } from "@/lib/static-render";
import { getViewer, requireViewer } from "@/server/auth";
import { canOpen, getEditorDocument } from "@/server/document-service";
import { RESERVED_SLUGS, normaliseSlug } from "@/server/document-utils";

import EditorContainer from "../../components/editor/EditorContainer";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/**
 * Notes are private: signed-out visitors (and link-preview bots) get nothing
 * about the note, not even whether it exists. Previews fall back to the brand image.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const viewer = await getViewer();
  const slug = normaliseSlug(raw);
  if (!viewer || !slug) return { title: "Sign in" };
  return { title: slug };
}

export default async function EditorPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = normaliseSlug(raw);
  if (!slug || RESERVED_SLUGS.has(slug)) notFound();
  if (slug !== raw) redirect(`/${slug}`);

  const viewer = await requireViewer(`/${slug}`);
  const doc = await getEditorDocument(slug);
  if (!canOpen(viewer, doc)) notFound();
  // A note in the trash: the admin restores it from the admin area.
  if (doc?.deleted) notFound();

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
      viewer={{ name: viewer.name, username: viewer.username, role: viewer.role }}
      visibility={doc?.visibility ?? "team"}
      share={viewer.role === "admin" ? (doc?.share ?? null) : null}
    />
  );
}
