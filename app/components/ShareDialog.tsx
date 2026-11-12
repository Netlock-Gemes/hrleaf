"use client";

import { Check, Copy, Eye, Globe, Loader2, Lock, PenLine, RefreshCw, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  /** Re-render the page behind once the dialog closes, if anything changed (the admin table). */
  refreshOnClose?: boolean;
};

type Access = { share: ShareLink | null; visibility: Visibility };

/**
 * Admin-only: who can open a note, and its public share link.
 *
 * Changes show at once and save in the background, one after another so quick
 * clicks land in order; a failed save puts that setting back. The actions skip
 * re-rendering the admin page, so a click costs one database write, and the
 * page behind refreshes once when the dialog closes.
 */
export default function ShareDialog({
  slug,
  share: initialShare,
  visibility: initialVis,
  open,
  onOpenChange,
  onChange,
  refreshOnClose = false,
}: Props) {
  const router = useRouter();
  const [share, setShare] = useState(initialShare);
  const [visibility, setVisibility] = useState(initialVis);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const current = useRef<Access>({ share: initialShare, visibility: initialVis });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const changed = useRef(false);
  const wasOpen = useRef(false);

  // Load the note's settings each time the dialog opens (not while it's open,
  // so a parent echoing our own changes back can't undo a newer click).
  useEffect(() => {
    if (open && !wasOpen.current) {
      current.current = { share: initialShare, visibility: initialVis };
      setShare(initialShare);
      setVisibility(initialVis);
      setCopied(false);
      changed.current = false;
    }
    wasOpen.current = open;
  }, [open, initialShare, initialVis]);

  if (!slug) return null;

  const apply = (next: Access) => {
    current.current = next;
    setShare(next.share);
    setVisibility(next.visibility);
  };

  /** Tell the parent, once a link exists for real (not while one is being created). */
  const notify = () => {
    const now = current.current;
    if (!now.share || now.share.token) onChange?.(now);
  };

  /** Run saves one at a time, in click order. */
  const enqueue = (task: () => Promise<void>) => {
    changed.current = true;
    queue.current = queue.current.then(task).catch(() => {
      toast.error("Couldn't reach the server. Try again.");
    }).finally(notify);
  };

  const changeVisibility = (v: Visibility) => {
    const before = current.current.visibility;
    if (v === before) return;
    apply({ ...current.current, visibility: v });
    enqueue(async () => {
      const res = await setVisibilityAction([slug], v, { refresh: false });
      if (!res.ok) {
        toast.error(res.message);
        if (current.current.visibility === v) apply({ ...current.current, visibility: before });
      }
    });
  };

  /** Turn the link on, or change what it allows. */
  const setMode = (mode: ShareMode) => {
    const before = current.current.share;
    if (before?.mode === mode) return;
    // No token yet when turning it on: the field says "Creating link…" until the server answers.
    const optimistic = { token: before?.token ?? "", mode, created_at: before?.created_at ?? new Date().toISOString() };
    apply({ ...current.current, share: optimistic });
    enqueue(async () => {
      const res = await setShareAction([slug], mode, { refresh: false });
      const now = current.current.share;
      if (!res.ok) {
        toast.error(res.message);
        if (now?.mode === mode) apply({ ...current.current, share: before });
        return;
      }
      // Turned off again meanwhile: leave it off (that save is queued behind this one).
      if (now) apply({ ...current.current, share: { ...now, token: res.links[0].token } });
    });
  };

  const disableShare = () => {
    const before = current.current.share;
    if (!before) return;
    apply({ ...current.current, share: null });
    enqueue(async () => {
      const res = await removeShareAction([slug], { refresh: false });
      if (!res.ok) {
        toast.error(res.message);
        if (!current.current.share) apply({ ...current.current, share: before });
      }
    });
  };

  const regenerate = () => {
    const mode = current.current.share?.mode;
    if (!mode) return;
    setRegenerating(true);
    enqueue(async () => {
      try {
        const res = await setShareAction([slug], mode, { regenerate: true, refresh: false });
        if (!res.ok) return void toast.error(res.message);
        const now = current.current.share;
        if (now) apply({ ...current.current, share: { ...now, token: res.links[0].token } });
        setCopied(false);
        toast.success(res.message);
      } finally {
        setRegenerating(false);
      }
    });
  };

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    // Refresh once, after the last save has landed, without holding up the close.
    if (!o && refreshOnClose && changed.current) void queue.current.then(() => router.refresh());
  };

  const creating = !!share && !share.token;
  const url = share ? shareUrl(share.token) : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            />
            <Choice
              checked={visibility === "private"}
              onClick={() => changeVisibility("private")}
              icon={<Lock className="h-4 w-4" aria-hidden />}
              title="Only me"
              detail="Hidden from members"
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
              onCheckedChange={(on) => (on ? setMode("read") : disableShare())}
              aria-labelledby="share-public"
            />
          </div>

          {share ? (
            <>
              <div role="radiogroup" aria-label="Link permission" className="grid grid-cols-2 gap-2">
                <Choice
                  checked={share.mode === "read"}
                  onClick={() => setMode("read")}
                  icon={<Eye className="h-4 w-4" aria-hidden />}
                  title="Can read"
                  detail="Last saved version"
                />
                <Choice
                  checked={share.mode === "write"}
                  onClick={() => setMode("write")}
                  icon={<PenLine className="h-4 w-4" aria-hidden />}
                  title="Can edit"
                  detail="Edits and saves"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={creating ? "Creating link…" : url}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Share link"
                  className="h-9 min-w-0 flex-1 rounded-md border border-input bg-[--surface-dark] px-2.5 font-mono text-[12.5px] text-[--text-secondary] outline-none focus-visible:border-[--leaf]"
                />
                <button
                  type="button"
                  disabled={creating}
                  onClick={async () => {
                    await copyText(url, "Link copied");
                    setCopied(true);
                  }}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : copied ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              <button
                type="button"
                onClick={regenerate}
                disabled={regenerating || creating}
                className="-ml-1.5 flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] text-[--text-tertiary] transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {regenerating ? (
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
