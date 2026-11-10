import { redirect } from "next/navigation";

import { findAvailableSlug } from "@/server/document-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  redirect(`/${await findAvailableSlug()}`);
}
