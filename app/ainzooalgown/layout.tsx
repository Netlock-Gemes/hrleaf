import { Metadata } from "next";

import SiteHeader from "@/app/components/SiteHeader";
import UserMenu from "@/app/components/UserMenu";
import { requireAdmin } from "@/server/auth";

import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="flex min-h-[100svh] flex-col">
      <SiteHeader wide homeHref="/ainzooalgown" trail={<span className="text-[13px] text-muted-foreground">Admin</span>}>
        <UserMenu viewer={admin} />
      </SiteHeader>
      <div className="sticky top-14 z-20 border-b border-border bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">
        <AdminNav />
      </div>
      {children}
    </div>
  );
}
