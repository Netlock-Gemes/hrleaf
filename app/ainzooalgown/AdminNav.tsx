"use client";

import { Activity, FileText, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/ainzooalgown", label: "Notes", icon: FileText },
  { href: "/ainzooalgown/users", label: "Users", icon: Users },
  { href: "/ainzooalgown/activity", label: "Activity", icon: Activity },
] as const;

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-3 sm:px-6">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/ainzooalgown" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-11 shrink-0 items-center gap-2 px-3 text-[13px] transition-colors duration-150 ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
            {active ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[--leaf]" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
