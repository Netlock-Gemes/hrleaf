"use client";

import { Home, KeyRound, Loader2, LogOut, Monitor, Moon, Search, Shield, Sun } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useSignOut } from "@/app/hooks/useSignOut";
import { useTheme } from "@/app/hooks/useTheme";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { openCommandPalette } from "@/lib/commands";
import { ThemePref } from "@/lib/theme";
import { changePasswordAction } from "@/server/auth-actions";
import { Viewer } from "@/types";

import CommandPalette from "./CommandPalette";

export type ViewerInfo = Pick<Viewer, "name" | "username" | "role">;

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.43) }}
      className="flex shrink-0 items-center justify-center rounded-full bg-[--primary-20] font-semibold text-[--leaf-strong] ring-1 ring-inset ring-[--leaf]/25"
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

export { useSignOut };

export default function UserMenu({ viewer, className = "" }: { viewer: ViewerInfo; className?: string }) {
  const { pending, signOut } = useSignOut();
  const { pref, setTheme } = useTheme();
  const [pwOpen, setPwOpen] = useState(false);
  const [mod, setMod] = useState("Ctrl+");
  useEffect(() => setMod(/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+"), []);
  const isAdmin = viewer.role === "admin";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account: ${viewer.name}`}
          className={`flex h-8 items-center gap-2 rounded-full p-0.5 text-[13px] text-[--text-secondary] transition-colors duration-150 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent ${className}`}
        >
          <Avatar name={viewer.name} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
            <Avatar name={viewer.name} size={32} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] text-foreground">{viewer.name}</span>
              <span className="block truncate text-[12px] text-muted-foreground">
                {isAdmin ? "Admin" : `@${viewer.username}`}
              </span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onSelect={() => requestAnimationFrame(openCommandPalette)}>
            <Search className="h-4 w-4" aria-hidden /> Search
            <DropdownMenuShortcut>{mod}K</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden /> All notes
            </Link>
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem asChild className="gap-2">
              <Link href="/ainzooalgown">
                <Shield className="h-4 w-4" aria-hidden /> Admin
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="gap-2" onSelect={() => setPwOpen(true)}>
              <KeyRound className="h-4 w-4" aria-hidden /> Change password
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="pb-1 text-[12px] font-normal text-muted-foreground">Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={pref} onValueChange={(v) => setTheme(v as ThemePref)}>
            <DropdownMenuRadioItem value="system" className="gap-2 pl-2 pr-8 [&>span:first-child]:left-auto [&>span:first-child]:right-2.5 data-[state=checked]:text-foreground" onSelect={(e) => e.preventDefault()}>
              <Monitor className="h-4 w-4" aria-hidden /> System
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="light" className="gap-2 pl-2 pr-8 [&>span:first-child]:left-auto [&>span:first-child]:right-2.5 data-[state=checked]:text-foreground" onSelect={(e) => e.preventDefault()}>
              <Sun className="h-4 w-4" aria-hidden /> Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" className="gap-2 pl-2 pr-8 [&>span:first-child]:left-auto [&>span:first-child]:right-2.5 data-[state=checked]:text-foreground" onSelect={(e) => e.preventDefault()}>
              <Moon className="h-4 w-4" aria-hidden /> Dark
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" disabled={pending} onSelect={signOut}>
            <LogOut className="h-4 w-4" aria-hidden /> {pending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {isAdmin ? null : <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />}
      <CommandPalette isAdmin={isAdmin} />
    </>
  );
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  };

  const submit = () => {
    if (next !== confirm) {
      setError("The new passwords don't match.");
      return;
    }
    start(async () => {
      const res = await changePasswordAction(current, next);
      if (res.ok) {
        toast.success("Password changed", { description: "Your other devices have been signed out." });
        reset();
        onOpenChange(false);
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>You&apos;ll stay signed in here. Other devices are signed out.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => (setCurrent(e.target.value), setError(null))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={next}
              onChange={(e) => (setNext(e.target.value), setError(null))}
              aria-describedby="pw-hint"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pw-confirm">Repeat new password</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => (setConfirm(e.target.value), setError(null))}
              required
            />
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-[--danger-text]">
              {error}
            </p>
          ) : (
            <p id="pw-hint" className="text-[12px] text-[--text-tertiary]">
              At least 10 characters.
            </p>
          )}
          <DialogFooter className="mt-1">
            <button
              type="submit"
              disabled={pending || !current || next.length < 10 || !confirm}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Change password
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
