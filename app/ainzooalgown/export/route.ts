import { audit } from "@/server/audit";
import { getViewer } from "@/server/auth";
import { exportAll } from "@/server/document-service";

export const dynamic = "force-dynamic";

/** Download every note as one JSON file. Built on request; nothing extra is stored. */
export async function GET() {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return new Response("Not found", { status: 404 });

  const stream = await exportAll();
  await audit({ actor: viewer.username, action: "downloaded a backup" });
  const day = new Date().toISOString().slice(0, 10);
  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hrleaf-backup-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
