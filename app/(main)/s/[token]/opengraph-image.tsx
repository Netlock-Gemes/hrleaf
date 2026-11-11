import { brandImage, noteImage } from "@/lib/og";
import { SITE_DESCRIPTION, noteSummary } from "@/lib/site";
import { getSharedDocument, noteFacts } from "@/server/document-service";

export const alt = "A shared HRLeaf note";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const doc = await getSharedDocument((await params).token).catch(() => null);
  if (!doc) return brandImage(SITE_DESCRIPTION);
  const meta = noteSummary({ ...noteFacts(doc), read_only: false });
  meta.push(doc.share?.mode === "write" && !doc.read_only ? "Can edit" : "Read only");
  return noteImage({ slug: doc.slug, meta, shared: true });
}
