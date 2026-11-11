import { PenLine } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { NewNoteButton } from "@/app/components/NewNoteDialog";
import PaletteButton from "@/app/components/PaletteButton";
import SiteHeader from "@/app/components/SiteHeader";
import StaticNote, { formatDay } from "@/app/components/StaticNote";
import UserMenu from "@/app/components/UserMenu";
import { getViewer, requireViewer } from "@/server/auth";
import { canOpen, getEditorDocument } from "@/server/document-service";
import { normaliseSlug } from "@/server/document-utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: raw } = await params;
  const slug = normaliseSlug(raw);
  if (!(await getViewer()) || !slug) return { title: "Sign in" };
  return { title: `${slug} (read only)` };
}

/** Read-only view of the last saved version, for signed-in people. */
export default async function ViewPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = normaliseSlug(raw);
  if (!slug) notFound();

  const viewer = await requireViewer(`/${slug}/view`);
  const doc = await getEditorDocument(slug);
  if (!canOpen(viewer, doc) || doc?.deleted) notFound();
  const updated = formatDay(doc?.updated_at);

  return (
    <div className="editor-main">
      <SiteHeader trail={<span className="block truncate font-mono text-[13px] text-[--text-secondary]">{slug}</span>}>
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
        <PaletteButton className="hidden sm:flex" />
        <NewNoteButton />
        <UserMenu viewer={viewer} className="ml-0.5" />
      </SiteHeader>
      <StaticNote content={doc?.content} />
    </div>
  );
}
