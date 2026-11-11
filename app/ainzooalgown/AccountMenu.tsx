"use client";

import { ExternalLink, LogOut } from "lucide-react";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/server/admin-actions";

export default function AccountMenu({ username }: { username: string }) {
  const [pending, start] = useTransition();
  const initial = (username[0] ?? "A").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="flex h-8 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[--primary-20] text-[12px] font-semibold text-[--leaf-strong] ring-1 ring-inset ring-[--leaf]/25"
        >
          {initial}
        </span>
        <span className="hidden sm:inline">{username}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-[12px] text-muted-foreground">Signed in as</span>
          <span className="block truncate text-[13px] text-foreground">{username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onSelect={() => window.open("/", "_blank", "noopener")}>
          <ExternalLink className="h-4 w-4" aria-hidden /> Open a random note
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2"
          disabled={pending}
          onSelect={() => start(() => logoutAction())}
        >
          <LogOut className="h-4 w-4" aria-hidden /> {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
