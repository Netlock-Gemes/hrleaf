"use client";

import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  MoreHorizontal,
  PenLine,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { copyText } from "@/app/components/ShareDialog";
import { Avatar } from "@/app/components/UserMenu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatedAgo } from "@/lib/site";
import {
  AdminActionResult,
  CredentialsResult,
  createUserAction,
  deleteUserAction,
  resetPasswordAction,
  signOutUserAction,
  updateUserAction,
} from "@/server/admin-actions";
import { UserSummary } from "@/types";

type Creds = { username: string; password: string; isNew: boolean };
type Confirm = { kind: "delete" | "reset" | "signout"; user: UserSummary };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function UsersPanel({ users, adminName }: { users: UserSummary[]; adminName: string; now: number }) {
  const [adding, setAdding] = useState(false);
  const [creds, setCreds] = useState<Creds | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [renaming, setRenaming] = useState<UserSummary | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<AdminActionResult>) =>
    start(async () => {
      const res = await fn();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });

  const active = users.filter((u) => !u.disabled).length;

  return (
    <>
      <div className="mb-7 flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-[1.75rem] font-semibold leading-none tracking-[-0.025em]">Users</h1>
          <p className="tabular text-[13px] text-muted-foreground">
            {users.length} member{users.length === 1 ? "" : "s"}
            {users.length !== active ? ` · ${users.length - active} disabled` : ""} · members can open and edit team notes,
            never this admin area
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[--leaf] px-3 text-[13px] font-medium text-[#0f1a13] shadow-[0_1px_0_rgba(255,255,255,0.2)_inset] transition-colors hover:bg-[--leaf-strong]"
        >
          <UserPlus className="h-4 w-4" aria-hidden /> Add user
        </button>
      </div>

      <ul className="panel divide-y divide-border/70 overflow-clip">
        {/* The admin, for context */}
        <li className="flex items-center gap-3 px-4 py-3.5">
          <Avatar name={adminName} size={34} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-[13.5px] font-medium text-foreground">
              {adminName}
              <span className="flex items-center gap-1 rounded-full border border-[--leaf]/35 px-1.5 py-px text-[11px] font-normal text-[--leaf-strong]">
                <Shield className="h-3 w-3" aria-hidden /> Admin
              </span>
            </p>
            <p className="text-[12.5px] text-[--text-tertiary]">You. Username and password come from the server settings.</p>
          </div>
        </li>

        {users.map((u) => (
          <li key={u.id} className={`flex items-center gap-3 px-4 py-3.5 ${u.disabled ? "opacity-60" : ""}`}>
            <Avatar name={u.name} size={34} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium text-foreground">
                <span className="truncate">{u.name}</span>
                {u.disabled ? (
                  <span className="shrink-0 rounded-full border border-border px-1.5 py-px text-[11px] font-normal text-[--text-secondary]">
                    Disabled
                  </span>
                ) : null}
              </p>
              <p className="tabular truncate text-[12.5px] text-[--text-tertiary]">
                <span className="font-mono">@{u.username}</span>
                <span className="hidden sm:inline"> · added {dateFmt.format(new Date(u.created_at))}</span>
                {" · "}
                {u.last_login_at ? `last signed in ${updatedAgo(u.last_login_at)}` : "never signed in"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Actions for ${u.username}`}
                disabled={pending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[--text-tertiary] transition-colors duration-150 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem className="gap-2" onSelect={() => setConfirm({ kind: "reset", user: u })}>
                  <KeyRound className="h-4 w-4" aria-hidden /> Reset password…
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => setRenaming(u)}>
                  <PenLine className="h-4 w-4" aria-hidden /> Change name…
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onSelect={() => setConfirm({ kind: "signout", user: u })}>
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out everywhere
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2"
                  onSelect={() => run(() => updateUserAction(u.id, { disabled: !u.disabled }))}
                >
                  {u.disabled ? (
                    <>
                      <UserCheck className="h-4 w-4" aria-hidden /> Enable account
                    </>
                  ) : (
                    <>
                      <UserX className="h-4 w-4" aria-hidden /> Disable account
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="gap-2 text-[hsl(2_80%_72%)] focus:bg-destructive/15 focus:text-[hsl(2_80%_75%)]"
                  onSelect={() => setConfirm({ kind: "delete", user: u })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete user…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}

        {users.length === 0 ? (
          <li className="px-4 py-12 text-center">
            <p className="text-sm text-foreground">No members yet.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Add a user, then send them the username and password. They sign in at /login.
            </p>
          </li>
        ) : null}
      </ul>

      <AddUserDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={(c) => {
          setAdding(false);
          setCreds({ ...c, isNew: true });
        }}
      />
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />
      <RenameUserDialog user={renaming} onClose={() => setRenaming(null)} />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="max-w-sm">
          {confirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {confirm.kind === "delete"
                    ? `Delete ${confirm.user.username}?`
                    : confirm.kind === "reset"
                      ? `Reset ${confirm.user.username}'s password?`
                      : `Sign ${confirm.user.username} out everywhere?`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {confirm.kind === "delete"
                    ? "They can't sign in any more. Notes they wrote stay where they are."
                    : confirm.kind === "reset"
                      ? "A new password is created and shown once. Their current password stops working and they're signed out on every device."
                      : "They'll need to sign in again on every device. Their password stays the same."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className={confirm.kind === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
                  onClick={() => {
                    const u = confirm.user;
                    if (confirm.kind === "delete") run(() => deleteUserAction(u.id));
                    else if (confirm.kind === "signout") run(() => signOutUserAction(u.id));
                    else
                      start(async () => {
                        const res = await resetPasswordAction(u.id);
                        if (res.ok) setCreds({ username: res.username, password: res.password, isNew: false });
                        else toast.error(res.message);
                      });
                  }}
                >
                  {confirm.kind === "delete" ? "Delete user" : confirm.kind === "reset" ? "Reset password" : "Sign out"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const toUsername = (v: string) => v.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9._-]/g, "").slice(0, 32);

function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (c: { username: string; password: string }) => void;
}) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [touchedUsername, setTouchedUsername] = useState(false);
  const [custom, setCustom] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) {
      setName("");
      setUsername("");
      setTouchedUsername(false);
      setCustom(false);
      setPassword("");
      setError(null);
    }
  }, [open]);

  const submit = () =>
    start(async () => {
      const res: CredentialsResult = await createUserAction({ username, name, password: custom ? password : undefined });
      if (res.ok) onCreated({ username: res.username, password: res.password });
      else setError(res.message);
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>They can open and edit team notes. They can&apos;t see notes marked Only me, or the admin area.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              autoFocus
              value={name}
              placeholder="Ravi Kumar"
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value);
                if (!touchedUsername) setUsername(toUsername(e.target.value.split(" ")[0] ?? ""));
                setError(null);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-username">Username</Label>
            <Input
              id="new-username"
              value={username}
              placeholder="ravi"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="font-mono"
              onChange={(e) => {
                setUsername(toUsername(e.target.value));
                setTouchedUsername(true);
                setError(null);
              }}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-password">Password</Label>
              <button
                type="button"
                onClick={() => setCustom((c) => !c)}
                className="text-[12px] text-[--text-tertiary] underline-offset-4 hover:text-foreground hover:underline"
              >
                {custom ? "Generate one instead" : "Set my own"}
              </button>
            </div>
            {custom ? (
              <Input
                id="new-password"
                type="text"
                value={password}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
                minLength={10}
                onChange={(e) => (setPassword(e.target.value), setError(null))}
                placeholder="At least 10 characters"
              />
            ) : (
              <p id="new-password" className="rounded-md border border-dashed border-border px-3 py-2 text-[12.5px] text-[--text-tertiary]">
                A strong password is generated and shown once, after you add them.
              </p>
            )}
          </div>
          {error ? (
            <p role="alert" className="text-[13px] text-[hsl(2_80%_72%)]">
              {error}
            </p>
          ) : null}
          <DialogFooter className="mt-1">
            <button
              type="submit"
              disabled={pending || username.length < 2 || (custom && password.length < 10)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Add user
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Shows a password exactly once, with everything needed to pass it on. */
function CredentialsDialog({ creds, onClose }: { creds: Creds | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [creds]);
  const signIn = typeof window === "undefined" ? "/login" : `${window.location.origin}/login`;
  const message = creds
    ? `HRLeaf sign-in\n${signIn}\nUsername: ${creds.username}\nPassword: ${creds.password}`
    : "";

  return (
    <Dialog open={creds !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[--primary-20] text-[--leaf-strong]">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
            {creds?.isNew ? "User added" : "Password reset"}
          </DialogTitle>
          <DialogDescription>
            Copy this now and send it to them privately. The password can&apos;t be shown again; you can only reset it.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-border bg-[--surface-dark] p-3.5 text-[13px]">
          <dt className="text-[--text-tertiary]">Sign in at</dt>
          <dd className="truncate font-mono text-[--text-secondary]">{signIn}</dd>
          <dt className="text-[--text-tertiary]">Username</dt>
          <dd className="font-mono text-foreground">{creds?.username}</dd>
          <dt className="text-[--text-tertiary]">Password</dt>
          <dd className="select-all font-mono text-foreground">{creds?.password}</dd>
        </dl>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm transition-colors hover:bg-accent"
          >
            Done
          </button>
          <button
            type="button"
            onClick={async () => {
              await copyText(message, "Sign-in details copied");
              setCopied(true);
            }}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Copy sign-in details"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameUserDialog({ user, onClose }: { user: UserSummary | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  return (
    <Dialog open={user !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Change name</DialogTitle>
          <DialogDescription>
            Shown in their account menu. Their username <span className="font-mono text-foreground">@{user?.username}</span> stays the same.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!user) return;
            start(async () => {
              const res = await updateUserAction(user.id, { name });
              if (res.ok) {
                toast.success("Name updated");
                onClose();
              } else toast.error(res.message);
            });
          }}
        >
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" maxLength={60} />
          <DialogFooter>
            <button
              type="submit"
              disabled={pending || !name.trim() || name === user?.name}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Save
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
