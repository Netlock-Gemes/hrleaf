"use client";

import { Check, Copy, Eye, Globe, Loader2, Lock, PenLine, RefreshCw, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  removeShareAction,
  setShareAction,
  setVisibilityAction,
} from "@/server/admin-actions";
import { ShareLink, ShareMode, Visibility } from "@/types";

export const shareUrl = (token: string) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/s/${token}`;

export async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label, { duration: 1600 });
  } catch {
    toast.error("Couldn't copy. Your browser blocked clipboard access.");
  }
}

type Props = {
  slug: string | null;
  share: ShareLink | null;
  visibility: Visibility;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lets the editor keep its own copy of the settings in sync. */
  onChange?: (next: { share: ShareLink | null; visibility: Visibility }) => void;
};

/** Admin-only: who can open a note, and its public share link. */
export default function ShareDialog({ slug, share: initialShare, visibility: initialVis, open, onOpenChange, onChange }: Props) {
  const router = useRouter();
  const [share, setShare] = useState(initialShare);
  const [visibility, setVisibility] = useState(initialVis);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setShare(initialShare);
      setVisibility(initialVis);
      setCopied(false);
    }
  }, [open, initialShare, initialVis]);

  if (!slug) return null;

  const commit = (next: { share: ShareLink | null; visibility: Visibility }) => {
    setShare(next.share);
    setVisibility(next.visibility);
    onChange?.(next);
    router.refresh();
  };

  const run = (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    start(async () => {
      await fn();
      setBusy(null);
    });
  };

  const changeVisibility = (v: Visibility) =>
    v !== visibility &&
    run("vis", async () => {
      const res = await setVisibilityAction([slug], v);
      if (!res.ok) return void toast.error(res.message);
      commit({ share, visibility: v });
    });

  const enableShare = (mode: ShareMode, regenerate = false) =>
    run(regenerate ? "regen" : mode, async () => {
      const res = await setShareAction([slug], mode, { regenerate });
      if (!res.ok) return void toast.error(res.message);
      const link = res.links[0];
      const next = { token: link.token, mode: link.mode, created_at: share?.created_at ?? new Date().toISOString() };
      commit({ share: next, visibility });
      setCopied(false);
      if (regenerate) toast.success(res.message);
    });

  const disableShare = () =>
    run("off", async () => {
      const res = await removeShareAction([slug]);
      if (!res.ok) return void toast.error(res.message);
      commit({ share: null, visibility });
      toast.success(res.message);
    });

  const url = share ? shareUrl(share.token) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b border-border p-5 pb-4">
          <DialogTitle>Share settings</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-foreground">{slug}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Visibility */}
        <section className="flex flex-col gap-2.5 p-5" aria-labelledby="share-vis">
          <h3 id="share-vis" className="text-[13px] font-medium text-foreground">
            Signed-in access
          </h3>
          <div role="radiogroup" className="grid grid-cols-2 gap-2">
            <Choice
              checked={visibility === "team"}
              onClick={() => changeVisibility("team")}
              icon={<Users className="h-4 w-4" aria-hidden />}
              title="Team"
              detail="You and every member"
              busy={busy === "vis" && visibility !== "team"}
            />
            <Choice
              checked={visibility === "private"}
              onClick={() => changeVisibility("private")}
              icon={<Lock className="h-4 w-4" aria-hidden />}
              title="Only me"
              detail="Hidden from members"
              busy={busy === "vis" && visibility !== "private"}
            />
          </div>
        </section>

        {/* Public link */}
        <section className="flex flex-col gap-3 border-t border-border p-5" aria-labelledby="share-public">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="share-public" className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <Globe className="h-3.5 w-3.5 text-[--text-tertiary]" aria-hidden /> Public link
              </h3>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                {share ? "Anyone with this link can open the note, no account needed." : "Off. Only signed-in people can open it."}
              </p>
            </div>
            <Switch
              checked={!!share}
              disabled={pending}
              onCheckedChange={(on) => (on ? enableShare("read") : disableShare())}
              aria-labelledby="share-public"
            />
          </div>

          {share ? (
            <>
              <div role="radiogroup" aria-label="Link permission" className="grid grid-cols-2 gap-2">
                <Choice
                  checked={share.mode === "read"}
                  onClick={() => share.mode !== "read" && enableShare("read")}
                  icon={<Eye className="h-4 w-4" aria-hidden />}
                  title="Can read"
                  detail="Last saved version"
                  busy={busy === "read"}
                />
                <Choice
                  checked={share.mode === "write"}
                  onClick={() => share.mode !== "write" && enableShare("write")}
                  icon={<PenLine className="h-4 w-4" aria-hidden />}
                  title="Can edit"
                  detail="Edits and saves"
                  busy={busy === "write"}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Share link"
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-[--surface-dark] px-2.5 font-mono text-[12.5px] text-[--text-secondary] outline-none focus-visible:border-[--leaf]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await copyText(url, "Link copied");
                    setCopied(true);
                  }}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => enableShare(share.mode, true)}
                disabled={pending}
                className="-ml-1.5 flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] text-[--text-tertiary] transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {busy === "regen" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                Replace link (the old one stops working)
              </button>
            </>
          ) : null}
        </section>
      </DialogContent>
    </Dialog>
  );
}

function Choice({
  checked,
  onClick,
  icon,
  title,
  detail,
  busy,
}: {
  checked: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-[background-color,border-color] duration-150 ${
        checked
          ? "border-[--leaf]/60 bg-[--primary-10]"
          : "border-border hover:border-[--text-disabled] hover:bg-accent/50"
      }`}
    >
      <span className={`mt-px ${checked ? "text-[--leaf-strong]" : "text-[--text-tertiary]"}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{title}</span>
        <span className="block text-[12px] text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}
