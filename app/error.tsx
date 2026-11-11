"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { LogoMark } from "@/app/components/Logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="flex min-h-[100svh] items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-[24rem] flex-col items-start gap-6">
        <LogoMark size={30} />
        <div>
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em]">Something went wrong</h1>
          <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
            HRLeaf couldn&apos;t load this page. It&apos;s usually a brief connection problem with the database. Your
            saved notes are safe, and unsaved changes are kept on this device.
          </p>
          {error.digest ? (
            <p className="mt-3 font-mono text-[12px] text-[--text-disabled]">Reference: {error.digest}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
          <Link
            href="/"
            className="flex h-9 items-center rounded-md border border-border px-3.5 text-[13px] transition-colors hover:bg-accent"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
