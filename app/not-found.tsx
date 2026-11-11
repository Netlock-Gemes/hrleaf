import Link from "next/link";

import { LogoMark } from "@/app/components/Logo";

export const metadata = { title: "Not found" };

/** One 404 for everything: missing pages, notes you can't open, and the admin area for non-admins. */
export default function NotFound() {
  return (
    <main id="main" className="flex min-h-[100svh] items-center justify-center px-5 py-12">
      <div className="flex w-full max-w-[24rem] flex-col items-start gap-6">
        <LogoMark size={30} />
        <div>
          <p className="tabular font-mono text-[13px] text-[--leaf-strong]">404</p>
          <h1 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.02em]">There&apos;s nothing here</h1>
          <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
            This page doesn&apos;t exist, or you don&apos;t have access to it. If someone sent you this link, ask them to
            check it.
          </p>
        </div>
        <Link
          href="/"
          className="flex h-9 items-center rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go to HRLeaf
        </Link>
      </div>
    </main>
  );
}
