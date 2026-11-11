"use client";

import Link from "next/link";

import { LogoMark, Wordmark } from "./Logo";

interface SiteHeaderProps {
  /** Shown after the wordmark, e.g. the current document name. */
  trail?: React.ReactNode;
  /** Right-aligned actions. */
  children?: React.ReactNode;
  homeHref?: string;
  wide?: boolean;
  sticky?: boolean;
  /** Intercept the logo link (e.g. to guard unsaved changes). */
  onNavigate?: (href: string) => void;
}

export default function SiteHeader({
  trail,
  children,
  homeHref = "/",
  wide = false,
  sticky = true,
  onNavigate,
}: SiteHeaderProps) {
  return (
    <header
      className={`${sticky ? "sticky top-0" : ""} z-30 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75 print:hidden`}
    >
      <div
        className={`mx-auto flex h-14 w-full items-center gap-2 px-3 sm:gap-3 sm:px-6 ${
          wide ? "max-w-6xl" : "max-w-[52rem] sm:px-0"
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Link
            href={homeHref}
            prefetch={false}
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate(homeHref);
              }
            }}
            className="flex shrink-0 items-center gap-2 rounded-md py-1 pr-1 text-[15px]"
            aria-label="HRLeaf home"
          >
            <LogoMark size={20} />
            <Wordmark className="hidden min-[400px]:inline" />
          </Link>
          {trail ? (
            <>
              <span aria-hidden className="text-[--text-disabled]">/</span>
              <div className="min-w-0">{trail}</div>
            </>
          ) : null}
        </div>
        {children ? (
          <div className="flex shrink-0 items-center gap-1">{children}</div>
        ) : null}
      </div>
    </header>
  );
}
