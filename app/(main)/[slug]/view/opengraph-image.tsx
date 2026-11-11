import { noteImage } from "@/lib/og";
import { noteSummary } from "@/lib/site";
import { getNoteFacts } from "@/server/document-service";
import { normaliseSlug } from "@/server/document-utils";

export const alt = "A read-only HRLeaf note";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = normaliseSlug(raw) ?? raw.slice(0, 64);
  const facts = await getNoteFacts(slug).catch(() => null);
  const meta = facts ? noteSummary({ ...facts, read_only: false }) : [];
  return noteImage({ slug, meta, view: true });
}
